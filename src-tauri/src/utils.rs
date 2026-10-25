use base64::{engine::general_purpose, Engine as _};
use windows::Win32::Foundation::{HGLOBAL, HWND};
use windows::Win32::Graphics::Imaging::{
    CLSID_WICImagingFactory, GUID_ContainerFormatPng, GUID_WICPixelFormat32bppPBGRA,
    IWICImagingFactory, WICBitmapEncoderNoCache,
};
use windows::Win32::System::Com::StructuredStorage::{CreateStreamOnHGlobal, GetHGlobalFromStream};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER};

/// True when the window's client area covers its monitor and it is not a
/// standard (captioned) maximized window — i.e. a real fullscreen window.
pub fn is_window_fullscreen(hwnd: HWND) -> bool {
    unsafe {
        use windows::Win32::Foundation::{POINT, RECT};
        use windows::Win32::Graphics::Gdi::{
            ClientToScreen, GetMonitorInfoA, MonitorFromWindow, MONITORINFO,
            MONITOR_DEFAULTTONEAREST,
        };
        use windows::Win32::UI::WindowsAndMessaging::{
            GetClientRect, GetWindowLongW, IsZoomed, GWL_STYLE, WS_CAPTION, WS_MAXIMIZE,
        };

        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if monitor.is_invalid() {
            return false;
        }
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if !GetMonitorInfoA(monitor, &mut info).as_bool() {
            return false;
        }
        let screen = info.rcMonitor;

        let mut client = RECT::default();
        if GetClientRect(hwnd, &mut client).is_err() {
            return false;
        }
        let mut top_left = POINT {
            x: client.left,
            y: client.top,
        };
        let mut bottom_right = POINT {
            x: client.right,
            y: client.bottom,
        };
        let _ = ClientToScreen(hwnd, &mut top_left);
        let _ = ClientToScreen(hwnd, &mut bottom_right);

        let style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
        let is_maximized_standard = (IsZoomed(hwnd).as_bool() || (style & WS_MAXIMIZE.0) != 0)
            && (style & WS_CAPTION.0) != 0;

        let client_fullscreen = top_left.x <= screen.left
            && top_left.y <= screen.top
            && bottom_right.x >= screen.right
            && bottom_right.y >= screen.bottom;
        client_fullscreen && !is_maximized_standard
    }
}

/// Encodes an `HBITMAP` (as returned by `IShellItemImageFactory::GetImage`) to a base64 PNG.
pub unsafe fn hbitmap_to_base64(hbitmap: windows::Win32::Graphics::Gdi::HBITMAP) -> Option<String> {
    let factory: IWICImagingFactory =
        CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER).ok()?;
    let bitmap = factory
        .CreateBitmapFromHBITMAP(
            hbitmap,
            windows::Win32::Graphics::Gdi::HPALETTE::default(),
            windows::Win32::Graphics::Imaging::WICBitmapUsePremultipliedAlpha,
        )
        .ok()?;
    wic_bitmap_to_base64(&factory, &bitmap)
}

unsafe fn wic_bitmap_to_base64(
    factory: &IWICImagingFactory,
    bitmap: &windows::Win32::Graphics::Imaging::IWICBitmapSource,
) -> Option<String> {
    let stream = CreateStreamOnHGlobal(HGLOBAL(std::ptr::null_mut()), true).ok()?;
    let encoder = factory
        .CreateEncoder(&GUID_ContainerFormatPng, std::ptr::null())
        .ok()?;
    encoder.Initialize(&stream, WICBitmapEncoderNoCache).ok()?;

    let mut frame = None;
    encoder
        .CreateNewFrame(&mut frame, std::ptr::null_mut())
        .ok()?;
    let frame = frame?;
    frame.Initialize(None).ok()?;

    let (mut width, mut height) = (0u32, 0u32);
    bitmap.GetSize(&mut width, &mut height).ok()?;
    frame.SetSize(width, height).ok()?;

    let mut format = GUID_WICPixelFormat32bppPBGRA;
    frame.SetPixelFormat(&mut format).ok()?;

    frame.WriteSource(bitmap, std::ptr::null()).ok()?;
    frame.Commit().ok()?;
    encoder.Commit().ok()?;

    let hglobal = GetHGlobalFromStream(&stream).ok()?;
    let ptr = windows::Win32::System::Memory::GlobalLock(hglobal);
    let size = windows::Win32::System::Memory::GlobalSize(hglobal);

    let data = std::slice::from_raw_parts(ptr as *const u8, size);
    let base64_str = general_purpose::STANDARD.encode(data);

    let _ = windows::Win32::System::Memory::GlobalUnlock(hglobal);

    Some(format!("data:image/png;base64,{}", base64_str))
}

pub fn get_now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

/// Parse the editable settings file without discarding a UTF-8 BOM.
pub fn read_settings_file(
    path: &std::path::Path,
) -> Result<std::collections::HashMap<String, serde_json::Value>, String> {
    match std::fs::read_to_string(path) {
        Ok(content) => serde_json::from_str(content.trim_start_matches('\u{feff}'))
            .map_err(|e| format!("Invalid settings file: {e}")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Default::default()),
        Err(e) => Err(format!("Could not read settings file: {e}")),
    }
}

/// Write a complete file in the same directory and replace the old file only
/// after the new contents are ready.
pub fn atomic_write_file(path: &std::path::Path, content: &[u8]) -> Result<(), String> {
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT_TEMP: AtomicU64 = AtomicU64::new(0);
    let temp = path.with_file_name(format!(
        "{}.tmp-{}-{}",
        path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("mathani"),
        std::process::id(),
        NEXT_TEMP.fetch_add(1, Ordering::Relaxed)
    ));
    if let Err(e) = std::fs::write(&temp, content) {
        let _ = std::fs::remove_file(&temp);
        return Err(format!("Could not write {}: {e}", temp.display()));
    }
    let mut replaced = std::fs::rename(&temp, path);
    for delay_ms in [25, 50, 100, 200] {
        if !replaced
            .as_ref()
            .is_err_and(|e| matches!(e.raw_os_error(), Some(5 | 32 | 33)))
        {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(delay_ms));
        replaced = std::fs::rename(&temp, path);
    }
    if let Err(e) = replaced {
        let _ = std::fs::remove_file(&temp);
        return Err(format!("Could not replace {}: {e}", path.display()));
    }
    Ok(())
}

pub fn write_settings_file(
    path: &std::path::Path,
    settings: &std::collections::HashMap<String, serde_json::Value>,
) -> Result<(), String> {
    let content = serde_json::to_vec(settings).map_err(|e| e.to_string())?;
    atomic_write_file(path, &content)
}

pub fn save_setting_file(
    path: &std::path::Path,
    key: String,
    value: serde_json::Value,
) -> Result<std::collections::HashMap<String, serde_json::Value>, String> {
    let _guard = crate::state::SETTINGS_FILE_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    let mut settings = read_settings_file(path)?;
    settings.insert(key, value);
    write_settings_file(path, &settings)?;
    replace_settings_cache(settings.clone());
    Ok(settings)
}

/// Load settings.json into the in-memory cache. Call once at startup.
pub fn init_settings_cache(app: &tauri::AppHandle) {
    use crate::state::SETTINGS_CACHE;
    use tauri::Manager;
    let cache =
        SETTINGS_CACHE.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()));
    if let Some(path) = app
        .path()
        .app_config_dir()
        .ok()
        .map(|p| p.join("settings.json"))
    {
        if let Ok(settings) = read_settings_file(&path) {
            if let Ok(mut cache) = cache.lock() {
                *cache = settings;
            }
        }
    }
}

pub fn replace_settings_cache(new_settings: std::collections::HashMap<String, serde_json::Value>) {
    let cache = crate::state::SETTINGS_CACHE
        .get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()));
    if let Ok(mut cache) = cache.lock() {
        *cache = new_settings;
    }
}

pub fn get_bloom_scale(_app: &tauri::AppHandle) -> f64 {
    get_setting_str(_app, "bloom-scale")
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(1.0)
}

/// Read any string value from the settings cache. Returns None if the key is absent.
pub fn get_setting_str(_app: &tauri::AppHandle, key: &str) -> Option<String> {
    let cache = crate::state::SETTINGS_CACHE.get()?;
    let guard = cache.lock().ok()?;
    guard.get(key)?.as_str().map(|s| s.to_string())
}

/// Makes a window click-through or not by its WS_EX_TRANSPARENT bit alone,
/// keeping WS_EX_LAYERED set in both states.
pub fn set_click_through(hwnd: HWND, ignore: bool) -> bool {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE,
    };
    unsafe {
        let current = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let wanted = click_through_style(current, ignore);
        if wanted == current {
            return false;
        }
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, wanted as isize);
        true
    }
}

fn click_through_style(style: u32, ignore: bool) -> u32 {
    use windows::Win32::UI::WindowsAndMessaging::{WS_EX_LAYERED, WS_EX_TRANSPARENT};
    let layered = style | WS_EX_LAYERED.0;
    if ignore {
        layered | WS_EX_TRANSPARENT.0
    } else {
        layered & !WS_EX_TRANSPARENT.0
    }
}

/// Re-assert HWND_TOPMOST without activating the window.
pub fn re_assert_topmost(hwnd: HWND) {
    unsafe {
        use windows::Win32::UI::WindowsAndMessaging::{
            GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, HWND_TOPMOST,
            SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSENDCHANGING, SWP_NOSIZE, WS_EX_NOACTIVATE,
            WS_EX_TOOLWINDOW,
        };
        let _ = SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOSENDCHANGING,
        );
        let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as usize;
        let new_ex = ex | WS_EX_NOACTIVATE.0 as usize | WS_EX_TOOLWINDOW.0 as usize;
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_ex as isize);
    }
}
