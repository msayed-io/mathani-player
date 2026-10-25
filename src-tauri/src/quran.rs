//! Local Quran audio scanning, Arabic/UTF-16/Windows-1256 ID3v2 tag parsing,
//! embedded artwork extraction, and `quran://` HTTP 206 Range audio streaming.

use base64::{
    engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD},
    Engine as _,
};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp3", "m4a", "aac", "flac", "wav", "ogg", "opus", "wma", "webm",
];

const MAX_STREAM_CHUNK_BYTES: u64 = 2 * 1024 * 1024; // 2 MiB per Range response

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct RawScannedTrack {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub id3_title: Option<String>,
    pub id3_artist: Option<String>,
    pub id3_album: Option<String>,
    pub id3_track: Option<u32>,
    pub embedded_artwork: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ClassifiedPaths {
    pub folders: Vec<String>,
    pub files: Vec<String>,
}

/// Windows-1256 (Arabic ANSI) upper table `0x80..=0xFF` for legacy Arabic MP3 tags.
const WINDOWS_1256_HIGH: [char; 128] = [
    '\u{20AC}', '\u{067E}', '\u{201A}', '\u{0192}', '\u{201E}', '\u{2026}', '\u{2020}', '\u{2021}',
    '\u{02C6}', '\u{2030}', '\u{0679}', '\u{2039}', '\u{0152}', '\u{0686}', '\u{0698}', '\u{0688}',
    '\u{06AF}', '\u{2018}', '\u{2019}', '\u{201C}', '\u{201D}', '\u{2022}', '\u{2013}', '\u{2014}',
    '\u{06A9}', '\u{2122}', '\u{0691}', '\u{203A}', '\u{0153}', '\u{200C}', '\u{200D}', '\u{06BA}',
    '\u{00A0}', '\u{060C}', '\u{00A2}', '\u{00A3}', '\u{00A4}', '\u{00A5}', '\u{00A6}', '\u{00A7}',
    '\u{00A8}', '\u{00A9}', '\u{06BE}', '\u{00AB}', '\u{00AC}', '\u{00AD}', '\u{00AE}', '\u{00AF}',
    '\u{00B0}', '\u{00B1}', '\u{00B2}', '\u{00B3}', '\u{00B4}', '\u{00B5}', '\u{00B6}', '\u{00B7}',
    '\u{00B8}', '\u{00B9}', '\u{061B}', '\u{00BB}', '\u{00BC}', '\u{00BD}', '\u{00BE}', '\u{061F}',
    '\u{06C1}', '\u{0621}', '\u{0622}', '\u{0623}', '\u{0624}', '\u{0625}', '\u{0626}', '\u{0627}',
    '\u{0628}', '\u{0629}', '\u{062A}', '\u{062B}', '\u{062C}', '\u{062D}', '\u{062E}', '\u{062F}',
    '\u{0630}', '\u{0631}', '\u{0632}', '\u{0633}', '\u{0634}', '\u{0635}', '\u{0636}', '\u{00D7}',
    '\u{0637}', '\u{0638}', '\u{0639}', '\u{063A}', '\u{0640}', '\u{0641}', '\u{0642}', '\u{0643}',
    '\u{00E0}', '\u{0644}', '\u{00E2}', '\u{0645}', '\u{0646}', '\u{0647}', '\u{0648}', '\u{00E7}',
    '\u{00E8}', '\u{00E9}', '\u{00EA}', '\u{00EB}', '\u{0649}', '\u{064A}', '\u{00EE}', '\u{00EF}',
    '\u{064B}', '\u{064C}', '\u{064D}', '\u{064E}', '\u{00F4}', '\u{064F}', '\u{0650}', '\u{00F7}',
    '\u{0651}', '\u{00F9}', '\u{0652}', '\u{00FB}', '\u{00FC}', '\u{200E}', '\u{200F}', '\u{06D2}',
];

fn is_supported_audio(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|ext| {
            let lower = ext.to_ascii_lowercase();
            SUPPORTED_EXTENSIONS.contains(&lower.as_str())
        })
        .unwrap_or(false)
}

fn audio_mime_for_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .as_deref()
    {
        Some("mp3") => "audio/mpeg",
        Some("m4a") => "audio/mp4",
        Some("aac") => "audio/aac",
        Some("flac") => "audio/flac",
        Some("wav") => "audio/wav",
        Some("ogg") => "audio/ogg",
        Some("opus") => "audio/ogg; codecs=opus",
        Some("wma") => "audio/x-ms-wma",
        Some("webm") => "audio/webm",
        _ => "application/octet-stream",
    }
}

fn decode_single_byte_or_utf8(bytes: &[u8]) -> String {
    let trimmed = match bytes.iter().position(|&b| b == 0) {
        Some(pos) => &bytes[..pos],
        None => bytes,
    };
    if let Ok(utf8) = std::str::from_utf8(trimmed) {
        return utf8.trim().to_string();
    }
    let has_arabic_range = trimmed.iter().any(|&b| (0xC1..=0xFA).contains(&b));
    let mut out = String::with_capacity(trimmed.len() * 2);
    for &b in trimmed {
        if b < 0x80 {
            out.push(b as char);
        } else if has_arabic_range {
            out.push(WINDOWS_1256_HIGH[(b - 0x80) as usize]);
        } else {
            out.push(b as char);
        }
    }
    out.trim().to_string()
}

fn decode_utf16(bytes: &[u8], default_be: bool) -> String {
    if bytes.len() < 2 {
        return String::new();
    }
    let (is_be, slice) = if bytes.starts_with(&[0xFE, 0xFF]) {
        (true, &bytes[2..])
    } else if bytes.starts_with(&[0xFF, 0xFE]) {
        (false, &bytes[2..])
    } else {
        (default_be, bytes)
    };
    let mut units = Vec::with_capacity(slice.len() / 2);
    for chunk in slice.chunks_exact(2) {
        let u = if is_be {
            u16::from_be_bytes([chunk[0], chunk[1]])
        } else {
            u16::from_le_bytes([chunk[0], chunk[1]])
        };
        if u == 0 {
            break;
        }
        units.push(u);
    }
    String::from_utf16_lossy(&units).trim().to_string()
}

fn decode_id3_text(payload: &[u8]) -> Option<String> {
    if payload.is_empty() {
        return None;
    }
    let enc = payload[0];
    let body = &payload[1..];
    let s = match enc {
        0 => decode_single_byte_or_utf8(body),
        1 => decode_utf16(body, false),
        2 => decode_utf16(body, true),
        3 => {
            let end = body.iter().position(|&b| b == 0).unwrap_or(body.len());
            String::from_utf8_lossy(&body[..end]).trim().to_string()
        }
        _ => decode_single_byte_or_utf8(payload),
    };
    let cleaned = s.trim_matches('\0').trim().to_string();
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

fn decode_apic_frame(payload: &[u8], is_v22: bool) -> Option<String> {
    if payload.len() < 8 {
        return None;
    }
    let enc = payload[0];
    let mut idx = 1usize;

    let mime = if is_v22 {
        if idx + 3 > payload.len() {
            return None;
        }
        let fmt = std::str::from_utf8(&payload[idx..idx + 3])
            .unwrap_or("")
            .to_ascii_uppercase();
        idx += 3;
        match fmt.as_str() {
            "PNG" => "image/png".to_string(),
            _ => "image/jpeg".to_string(),
        }
    } else {
        let end = payload[idx..].iter().position(|&b| b == 0)?;
        let m = String::from_utf8_lossy(&payload[idx..idx + end])
            .trim()
            .to_ascii_lowercase();
        idx += end + 1;
        if m.starts_with("image/") {
            m
        } else {
            "image/jpeg".to_string()
        }
    };

    // Skip picture type byte
    if idx >= payload.len() {
        return None;
    }
    idx += 1;

    // Skip null-terminated description
    if enc == 1 || enc == 2 {
        let mut found = None;
        let mut p = idx;
        while p + 1 < payload.len() {
            if payload[p] == 0 && payload[p + 1] == 0 {
                found = Some(p + 2);
                break;
            }
            p += 2;
        }
        idx = found?;
    } else {
        let rel = payload[idx..].iter().position(|&b| b == 0)?;
        idx += rel + 1;
    }

    if idx >= payload.len() {
        return None;
    }
    let img_bytes = &payload[idx..];
    if img_bytes.len() < 16 || img_bytes.len() > 6 * 1024 * 1024 {
        return None;
    }
    Some(format!(
        "data:{};base64,{}",
        mime,
        STANDARD.encode(img_bytes)
    ))
}

fn synchsafe_u32(b: &[u8]) -> u32 {
    ((b[0] as u32 & 0x7F) << 21)
        | ((b[1] as u32 & 0x7F) << 14)
        | ((b[2] as u32 & 0x7F) << 7)
        | (b[3] as u32 & 0x7F)
}

#[derive(Default)]
struct ParsedId3 {
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    track: Option<u32>,
    artwork: Option<String>,
}

fn parse_id3_from_file(path: &Path, include_artwork: bool) -> ParsedId3 {
    let mut out = ParsedId3::default();
    let Ok(mut file) = File::open(path) else {
        return out;
    };

    let mut header = [0u8; 10];
    if file.read_exact(&mut header).is_err() {
        return out;
    }
    if &header[0..3] != b"ID3" {
        return out;
    }

    let version_major = header[3];
    let flags = header[5];
    let tag_size = synchsafe_u32(&header[6..10]) as usize;
    if tag_size == 0 {
        return out;
    }

    let max_read = if include_artwork {
        tag_size.min(8 * 1024 * 1024)
    } else {
        tag_size.min(192 * 1024)
    };

    let mut buf = vec![0u8; max_read];
    let Ok(bytes_read) = file.read(&mut buf) else {
        return out;
    };
    buf.truncate(bytes_read);

    let mut pos = 0usize;
    // Skip extended header if present on v2.3/v2.4
    if (version_major == 3 || version_major == 4) && (flags & 0x40) != 0 && buf.len() >= 4 {
        let ext_size = if version_major == 4 {
            synchsafe_u32(&buf[0..4]) as usize
        } else {
            u32::from_be_bytes([buf[0], buf[1], buf[2], buf[3]]) as usize
        };
        pos = ext_size.min(buf.len());
    }

    while pos < buf.len() {
        if version_major == 2 {
            if pos + 6 > buf.len() {
                break;
            }
            let id = &buf[pos..pos + 3];
            if id == [0, 0, 0] {
                break;
            }
            let size = ((buf[pos + 3] as usize) << 16)
                | ((buf[pos + 4] as usize) << 8)
                | (buf[pos + 5] as usize);
            pos += 6;
            if size == 0 || pos + size > buf.len() {
                break;
            }
            let payload = &buf[pos..pos + size];
            match id {
                b"TT2" => out.title = decode_id3_text(payload),
                b"TP1" => out.artist = decode_id3_text(payload),
                b"TAL" => out.album = decode_id3_text(payload),
                b"TRK" => {
                    out.track = decode_id3_text(payload).and_then(|t| {
                        t.split('/').next().and_then(|n| n.trim().parse::<u32>().ok())
                    });
                }
                b"PIC" if include_artwork && out.artwork.is_none() => {
                    out.artwork = decode_apic_frame(payload, true);
                }
                _ => {}
            }
            pos += size;
        } else {
            if pos + 10 > buf.len() {
                break;
            }
            let id = &buf[pos..pos + 4];
            if id == [0, 0, 0, 0]
                || !id
                    .iter()
                    .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
            {
                break;
            }
            let size = if version_major == 4 {
                synchsafe_u32(&buf[pos + 4..pos + 8]) as usize
            } else {
                u32::from_be_bytes([buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]])
                    as usize
            };
            pos += 10;
            if size == 0 {
                continue;
            }
            if pos + size > buf.len() {
                break;
            }
            let payload = &buf[pos..pos + size];
            match id {
                b"TIT2" => out.title = decode_id3_text(payload),
                b"TPE1" => out.artist = decode_id3_text(payload),
                b"TALB" => out.album = decode_id3_text(payload),
                b"TRCK" => {
                    out.track = decode_id3_text(payload).and_then(|t| {
                        t.split('/').next().and_then(|n| n.trim().parse::<u32>().ok())
                    });
                }
                b"APIC" if include_artwork && out.artwork.is_none() => {
                    out.artwork = decode_apic_frame(payload, false);
                }
                _ => {}
            }
            pos += size;
        }

        if !include_artwork
            && out.title.is_some()
            && out.artist.is_some()
            && out.album.is_some()
            && out.track.is_some()
        {
            break;
        }
    }

    out
}

fn scan_path_recursive(
    path: &Path,
    depth: usize,
    out: &mut Vec<RawScannedTrack>,
    seen: &mut std::collections::HashSet<String>,
) {
    if depth > 7 || out.len() >= 5000 {
        return;
    }

    if path.is_file() {
        if !is_supported_audio(path) {
            return;
        }
        let full = path.to_string_lossy().to_string();
        let key = full.to_lowercase();
        if !seen.insert(key) {
            return;
        }
        let size_bytes = path.metadata().map(|m| m.len()).unwrap_or(0);
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default()
            .to_string();
        let id3 = if path
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| e.eq_ignore_ascii_case("mp3"))
        {
            parse_id3_from_file(path, false)
        } else {
            ParsedId3::default()
        };

        out.push(RawScannedTrack {
            path: full,
            file_name,
            size_bytes,
            id3_title: id3.title,
            id3_artist: id3.artist,
            id3_album: id3.album,
            id3_track: id3.track,
            embedded_artwork: None,
        });
        return;
    }

    if path.is_dir() {
        let Ok(entries) = std::fs::read_dir(path) else {
            return;
        };
        let mut children: Vec<PathBuf> = entries.filter_map(|e| e.ok().map(|x| x.path())).collect();
        children.sort();
        for child in children {
            if child
                .file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with('.'))
            {
                continue;
            }
            scan_path_recursive(&child, depth + 1, out, seen);
        }
    }
}

#[tauri::command]
pub async fn scan_quran_paths(paths: Vec<String>) -> Vec<RawScannedTrack> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut tracks = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for raw in paths {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                continue;
            }
            scan_path_recursive(Path::new(trimmed), 0, &mut tracks, &mut seen);
        }
        tracks
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
pub async fn classify_dropped_paths(paths: Vec<String>) -> ClassifiedPaths {
    tauri::async_runtime::spawn_blocking(move || {
        let mut folders = Vec::new();
        let mut files = Vec::new();
        for p in paths {
            let pb = PathBuf::from(&p);
            if pb.is_dir() {
                folders.push(p);
            } else if pb.is_file() && is_supported_audio(&pb) {
                files.push(p);
            }
        }
        ClassifiedPaths { folders, files }
    })
    .await
    .unwrap_or(ClassifiedPaths {
        folders: Vec::new(),
        files: Vec::new(),
    })
}

#[tauri::command]
pub async fn get_track_embedded_artwork(path: String) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = Path::new(&path);
        if !p.exists() {
            return None;
        }
        parse_id3_from_file(p, true).artwork
    })
    .await
    .ok()
    .flatten()
}

fn dir_contains_any_audio(dir: &Path, depth: usize) -> bool {
    if depth > 2 {
        return false;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return false;
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_file() && is_supported_audio(&p) {
            return true;
        }
        if p.is_dir() && dir_contains_any_audio(&p, depth + 1) {
            return true;
        }
    }
    false
}

fn is_quran_folder_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    const KEYWORDS: &[&str] = &[
        "quran",
        "quraan",
        "koran",
        "mushaf",
        "tilaw",
        "قرآن",
        "قران",
        "القرآن",
        "القران",
        "تلاوات",
        "تلاوة",
        "مصحف",
        "المصحف",
    ];
    KEYWORDS.iter().any(|k| lower.contains(k))
}

#[tauri::command]
pub async fn auto_discover_quran_folders() -> Vec<String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut found = Vec::new();
        let mut seen = std::collections::HashSet::new();

        let mut roots: Vec<PathBuf> = Vec::new();
        if let Ok(profile) = std::env::var("USERPROFILE") {
            let base = PathBuf::from(profile);
            for sub in ["Music", "Downloads", "Desktop", "Documents", "Videos"] {
                let candidate = base.join(sub);
                if candidate.is_dir() {
                    roots.push(candidate);
                }
            }
        }
        for drive in ["D:\\", "E:\\", "F:\\"] {
            let dp = PathBuf::from(drive);
            if dp.is_dir() {
                roots.push(dp);
            }
        }

        for root in roots {
            let Ok(entries) = std::fs::read_dir(&root) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                    continue;
                };
                if is_quran_folder_name(name) && dir_contains_any_audio(&path, 0) {
                    let s = path.to_string_lossy().to_string();
                    if seen.insert(s.to_lowercase()) {
                        found.push(s);
                    }
                }
            }
        }
        found
    })
    .await
    .unwrap_or_default()
}

fn decode_requested_file_path(uri: &tauri::http::Uri) -> Option<PathBuf> {
    let query = uri.query()?;
    for pair in query.split('&') {
        if let Some(val) = pair.strip_prefix("f=") {
            // Decode URL-safe base64 (with or without padding)
            let cleaned = val.trim_end_matches('=');
            let bytes = URL_SAFE_NO_PAD.decode(cleaned).ok()?;
            let path_str = String::from_utf8(bytes).ok()?;
            return Some(PathBuf::from(path_str));
        }
    }
    None
}

fn parse_range_header(header_val: &str, total_len: u64) -> Option<(u64, u64)> {
    let spec = header_val.trim().strip_prefix("bytes=")?;
    let first_range = spec.split(',').next()?.trim();
    let (start_s, end_s) = first_range.split_once('-')?;

    if start_s.is_empty() {
        // Suffix range: bytes=-500
        let suffix: u64 = end_s.parse().ok()?;
        if suffix == 0 || total_len == 0 {
            return None;
        }
        let start = total_len.saturating_sub(suffix);
        return Some((start, total_len - 1));
    }

    let start: u64 = start_s.parse().ok()?;
    if start >= total_len {
        return None;
    }

    let requested_end = if end_s.is_empty() {
        (start + MAX_STREAM_CHUNK_BYTES - 1).min(total_len - 1)
    } else {
        end_s
            .parse::<u64>()
            .ok()?
            .min(total_len - 1)
            .min(start + MAX_STREAM_CHUNK_BYTES - 1)
    };

    if requested_end < start {
        return None;
    }
    Some((start, requested_end))
}

fn empty_response(status: tauri::http::StatusCode) -> tauri::http::Response<Vec<u8>> {
    tauri::http::Response::builder()
        .status(status)
        .header("Access-Control-Allow-Origin", "*")
        .header("Accept-Ranges", "bytes")
        .body(Vec::new())
        .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()))
}

/// Serves local Quran audio files over `quran://localhost/stream?f=<base64url>`
/// (`http://quran.localhost/stream?f=<base64url>` on Windows WebView2) with
/// full HTTP 206 Partial Content byte-range support for instant seeking.
pub fn handle_quran_stream_request(
    request: tauri::http::Request<Vec<u8>>,
) -> tauri::http::Response<Vec<u8>> {
    use tauri::http::StatusCode;

    if request.method() == tauri::http::Method::OPTIONS {
        return tauri::http::Response::builder()
            .status(StatusCode::NO_CONTENT)
            .header("Access-Control-Allow-Origin", "*")
            .header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
            .header("Access-Control-Allow-Headers", "Range, Content-Type")
            .header("Accept-Ranges", "bytes")
            .body(Vec::new())
            .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()));
    }

    let Some(path) = decode_requested_file_path(request.uri()) else {
        return empty_response(StatusCode::BAD_REQUEST);
    };

    if !is_supported_audio(&path) || !path.is_file() {
        return empty_response(StatusCode::NOT_FOUND);
    }

    let Ok(mut file) = File::open(&path) else {
        return empty_response(StatusCode::NOT_FOUND);
    };
    let Ok(meta) = file.metadata() else {
        return empty_response(StatusCode::INTERNAL_SERVER_ERROR);
    };
    let total_len = meta.len();
    let mime = audio_mime_for_path(&path);

    if total_len == 0 {
        return empty_response(StatusCode::NO_CONTENT);
    }

    let range_header = request
        .headers()
        .get("range")
        .or_else(|| request.headers().get("Range"))
        .and_then(|v| v.to_str().ok());

    if let Some(rh) = range_header {
        let Some((start, end)) = parse_range_header(rh, total_len) else {
            return tauri::http::Response::builder()
                .status(StatusCode::RANGE_NOT_SATISFIABLE)
                .header("Access-Control-Allow-Origin", "*")
                .header("Accept-Ranges", "bytes")
                .header("Content-Range", format!("bytes */{}", total_len))
                .body(Vec::new())
                .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()));
        };

        let chunk_len = (end - start + 1) as usize;
        if file.seek(SeekFrom::Start(start)).is_err() {
            return empty_response(StatusCode::INTERNAL_SERVER_ERROR);
        }
        let mut buf = vec![0u8; chunk_len];
        let Ok(n) = file.read(&mut buf) else {
            return empty_response(StatusCode::INTERNAL_SERVER_ERROR);
        };
        buf.truncate(n);
        let actual_end = if n > 0 { start + (n as u64) - 1 } else { start };

        return tauri::http::Response::builder()
            .status(StatusCode::PARTIAL_CONTENT)
            .header("Content-Type", mime)
            .header("Accept-Ranges", "bytes")
            .header(
                "Content-Range",
                format!("bytes {}-{}/{}", start, actual_end, total_len),
            )
            .header("Content-Length", n.to_string())
            .header("Access-Control-Allow-Origin", "*")
            .header("Cache-Control", "no-store")
            .body(buf)
            .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()));
    }

    // If no Range header was sent, cap initial response for huge files or return full if <= 8 MiB
    let read_len = total_len.min(8 * 1024 * 1024) as usize;
    let mut buf = vec![0u8; read_len];
    let Ok(n) = file.read(&mut buf) else {
        return empty_response(StatusCode::INTERNAL_SERVER_ERROR);
    };
    buf.truncate(n);

    if (n as u64) < total_len {
        return tauri::http::Response::builder()
            .status(StatusCode::PARTIAL_CONTENT)
            .header("Content-Type", mime)
            .header("Accept-Ranges", "bytes")
            .header(
                "Content-Range",
                format!("bytes 0-{}/{}", n.saturating_sub(1), total_len),
            )
            .header("Content-Length", n.to_string())
            .header("Access-Control-Allow-Origin", "*")
            .body(buf)
            .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()));
    }

    tauri::http::Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", mime)
        .header("Accept-Ranges", "bytes")
        .header("Content-Length", n.to_string())
        .header("Access-Control-Allow-Origin", "*")
        .body(buf)
        .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()))
}
