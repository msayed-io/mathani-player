import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Effect } from "@tauri-apps/api/window";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
	BookOpen,
	Users,
	Repeat,
	Bookmark,
	History,
	FolderOpen,
	FolderPlus,
	FileAudio,
	Sparkles,
	Search,
	X,
	Minus,
	Square,
	Heart,
	Moon,
	PanelTop,
	RefreshCw,
	Trash2,
	CheckCircle2,
	Compass,
	Sliders,
	Play
} from "lucide-react";
import { initTheme } from "./theme";
import { useSettings, NotchTab, AppearanceTab, GeneralTab } from "./settings";
import {
	PlayIcon,
	PauseIcon,
	SkipBackIcon,
	SkipForwardIcon,
	SpeakerIcon,
	MusicNoteIcon
} from "./icons";
import { SURAHS, detectSurah, detectReciter, normalizeArabic, toArabicDigits } from "./quranData";
import { buildSurahArtwork } from "./surahArtwork";
import "./Settings.css";
import "./PlayerApp.css";

interface RawScannedTrack {
	path: string;
	file_name: string;
	size_bytes: number;
	id3_title?: string | null;
	id3_artist?: string | null;
	id3_album?: string | null;
	id3_track?: number | null;
	embedded_artwork?: string | null;
}

export interface QuranTrack {
	id: string;
	path: string;
	fileName: string;
	sizeBytes: number;
	surahNumber: number | null;
	displayTitle: string;
	reciter: string;
	revelationType: "meccan" | "medinan" | null;
	ayahs: number | null;
	juz: number | null;
	artworkUrl: string;
}

interface BookmarkItem {
	id: string;
	trackPath: string;
	surahTitle: string;
	reciter: string;
	positionSec: number;
	note: string;
	createdAt: number;
}

interface MathaniCommandPayload {
	action: "play-pause" | "next" | "previous" | "seek";
	position_ms?: number;
}

type NavSection = "library" | "reciters" | "memorize" | "khatmah" | "folders" | "island";
type LibraryFilter = "all" | "meccan" | "medinan" | "favorites" | "recent";
type RepeatMode = "sequence" | "one" | "off";

const STORAGE_FOLDERS = "mathani-library-folders";
const STORAGE_FILES = "mathani-library-extra-files";
const STORAGE_FAVS = "mathani-favorites";
const STORAGE_BOOKMARKS = "mathani-bookmarks";
const STORAGE_COMPLETED = "mathani-completed-surahs";
const STORAGE_RECENT = "mathani-recent-paths";
const STORAGE_LAST_SESSION = "mathani-last-session";

function encodePathBase64Url(filePath: string): string {
	const bytes = new TextEncoder().encode(filePath);
	let bin = "";
	for (let i = 0; i < bytes.length; i++) {
		bin += String.fromCharCode(bytes[i]);
	}
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildAudioStreamUrl(filePath: string): string {
	const base = convertFileSrc("stream", "quran");
	return `${base}?f=${encodePathBase64Url(filePath)}`;
}

function formatDuration(sec: number): string {
	if (!Number.isFinite(sec) || sec <= 0) return "0:00";
	const total = Math.floor(sec);
	const hrs = Math.floor(total / 3600);
	const mins = Math.floor((total % 3600) / 60);
	const secs = total % 60;
	if (hrs > 0) {
		return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	}
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function enrichRawTrack(raw: RawScannedTrack): QuranTrack {
	const noExt = raw.file_name.replace(/\.[^.]+$/, "");
	const surah = detectSurah(noExt, raw.id3_title, raw.id3_track);
	const reciter = detectReciter(raw.path, raw.id3_artist, raw.id3_album);
	const displayTitle = surah
		? `سورة ${surah.name}`
		: raw.id3_title && raw.id3_title.trim().length > 1
			? raw.id3_title.trim()
			: noExt.replace(/[_-]+/g, " ").trim();
	const artworkUrl =
		raw.embedded_artwork && raw.embedded_artwork.startsWith("data:image/")
			? raw.embedded_artwork
			: buildSurahArtwork(surah?.number ?? null, displayTitle, reciter);

	return {
		id: raw.path,
		path: raw.path,
		fileName: raw.file_name,
		sizeBytes: raw.size_bytes,
		surahNumber: surah?.number ?? null,
		displayTitle,
		reciter,
		revelationType: surah?.revelationType ?? null,
		ayahs: surah?.ayahs ?? null,
		juz: surah?.juz ?? null,
		artworkUrl
	};
}

const PlayerVisualizer = memo(function PlayerVisualizer({ isPlaying }: { isPlaying: boolean }) {
	const [bars, setBars] = useState<number[]>([0.2, 0.2, 0.2, 0.2, 0.2]);

	useEffect(() => {
		if (!isPlaying) {
			setBars([0.2, 0.2, 0.2, 0.2, 0.2]);
			return;
		}
		const unlisten = listen<{ frequencies: number[] }>("audio-visualization", (ev) => {
			const next = ev.payload.frequencies.slice(0, 5);
			while (next.length < 5) next.push(0.2);
			setBars(next);
		});
		return () => {
			unlisten.then((fn) => fn());
		};
	}, [isPlaying]);

	return (
		<div style={{ display: "inline-flex", alignItems: "center", gap: 3, height: 18 }}>
			{bars.map((v, idx) => (
				<motion.span
					key={idx}
					animate={{
						height: isPlaying ? `${Math.max(4, Math.min(18, Math.round(v * 18)))}px` : "4px",
						opacity: isPlaying ? 0.95 : 0.4
					}}
					transition={{ type: "spring", stiffness: 520, damping: 28 }}
					style={{
						width: 3,
						borderRadius: 99,
						background: "var(--m-accent, #10b981)",
						display: "inline-block"
					}}
				/>
			))}
		</div>
	);
});

const THEME_PRESETS = [
	{ name: "زمردي نبوي", hex: "#10b981" },
	{ name: "ذهبي مصحفي", hex: "#d4a853" },
	{ name: "لازوردي أندلسي", hex: "#3b82f6" },
	{ name: "مسك ملكي", hex: "#8b5cf6" },
	{ name: "عقيق يماني", hex: "#e11d48" }
];

export function PlayerApp() {
	const appWindow = useMemo(() => getCurrentWebviewWindow(), []);
	const islandSettings = useSettings();

	const [isMaximized, setIsMaximized] = useState(false);
	const [isDragHover, setIsDragHover] = useState(false);
	const [activeNav, setActiveNav] = useState<NavSection>("library");
	const [selectedReciterFilter, setSelectedReciterFilter] = useState<string | null>(null);
	const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
	const [searchQuery, setSearchQuery] = useState("");

	const [folders, setFolders] = useState<string[]>(() => {
		try {
			return JSON.parse(localStorage.getItem(STORAGE_FOLDERS) || "[]");
		} catch {
			return [];
		}
	});
	const [extraFiles, setExtraFiles] = useState<string[]>(() => {
		try {
			return JSON.parse(localStorage.getItem(STORAGE_FILES) || "[]");
		} catch {
			return [];
		}
	});
	const [tracks, setTracks] = useState<QuranTrack[]>([]);
	const [isScanning, setIsScanning] = useState(false);

	const [favorites, setFavorites] = useState<string[]>(() => {
		try {
			return JSON.parse(localStorage.getItem(STORAGE_FAVS) || "[]");
		} catch {
			return [];
		}
	});
	const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => {
		try {
			return JSON.parse(localStorage.getItem(STORAGE_BOOKMARKS) || "[]");
		} catch {
			return [];
		}
	});
	const [completedSurahs, setCompletedSurahs] = useState<number[]>(() => {
		try {
			return JSON.parse(localStorage.getItem(STORAGE_COMPLETED) || "[]");
		} catch {
			return [];
		}
	});
	const [recentPaths, setRecentPaths] = useState<string[]>(() => {
		try {
			return JSON.parse(localStorage.getItem(STORAGE_RECENT) || "[]");
		} catch {
			return [];
		}
	});
	const [savedSession] = useState<{ path: string; positionSec: number } | null>(() => {
		try {
			return JSON.parse(localStorage.getItem(STORAGE_LAST_SESSION) || "null");
		} catch {
			return null;
		}
	});

	// Audio Playback State
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [currentTrack, setCurrentTrack] = useState<QuranTrack | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTimeSec, setCurrentTimeSec] = useState(0);
	const [durationSec, setDurationSec] = useState(0);
	const [playerVolume, setPlayerVolume] = useState(() => {
		const cached = localStorage.getItem("mathani-player-volume");
		return cached ? parseFloat(cached) : 0.92;
	});
	const [playbackRate, setPlaybackRate] = useState(1.0);
	const [repeatMode, setRepeatMode] = useState<RepeatMode>("sequence");

	// A-B Memorization Loop
	const [loopPointA, setLoopPointA] = useState<number | null>(null);
	const [loopPointB, setLoopPointB] = useState<number | null>(null);
	const [loopMaxRepeats, setLoopMaxRepeats] = useState<number>(0); // 0 = infinite
	const [loopDoneCount, setLoopDoneCount] = useState<number>(0);

	// Bookmark note input
	const [bookmarkNote, setBookmarkNote] = useState("");

	// Sleep Timer
	const [sleepMode, setSleepMode] = useState<"off" | "end-of-surah" | "minutes">("off");
	const [sleepRemainingSec, setSleepRemainingSec] = useState<number>(0);

	// Bloom's signature slide-push button animation controllers
	const prevFront = useAnimation();
	const prevBack = useAnimation();
	const nextFront = useAnimation();
	const nextBack = useAnimation();

	useEffect(() => {
		return initTheme();
	}, []);

	// Apply Mica vibrancy & monitor maximize state + drag-drop
	useEffect(() => {
		const preventCtx = (e: MouseEvent) => e.preventDefault();
		document.addEventListener("contextmenu", preventCtx);

		appWindow
			.setEffects({
				effects: ["mica" as Effect],
				state: "active" as any
			})
			.catch(() => {});

		appWindow
			.isMaximized()
			.then(setIsMaximized)
			.catch(() => {});

		const unlistenResize = appWindow.onResized(async () => {
			try {
				setIsMaximized(await appWindow.isMaximized());
			} catch {}
		});

		const unlistenDrop = appWindow.onDragDropEvent((event) => {
			if (event.payload.type === "enter" || event.payload.type === "over") {
				setIsDragHover(true);
			} else if (event.payload.type === "leave") {
				setIsDragHover(false);
			} else if (event.payload.type === "drop") {
				setIsDragHover(false);
				const droppedPaths = event.payload.paths || [];
				if (droppedPaths.length > 0) {
					handleIngestDroppedPaths(droppedPaths);
				}
			}
		});

		return () => {
			document.removeEventListener("contextmenu", preventCtx);
			unlistenResize.then((f) => f());
			unlistenDrop.then((f) => f());
		};
	}, [appWindow]); // eslint-disable-line react-hooks/exhaustive-deps

	// Persist library metadata
	useEffect(() => {
		localStorage.setItem(STORAGE_FOLDERS, JSON.stringify(folders));
	}, [folders]);
	useEffect(() => {
		localStorage.setItem(STORAGE_FILES, JSON.stringify(extraFiles));
	}, [extraFiles]);
	useEffect(() => {
		localStorage.setItem(STORAGE_FAVS, JSON.stringify(favorites));
	}, [favorites]);
	useEffect(() => {
		localStorage.setItem(STORAGE_BOOKMARKS, JSON.stringify(bookmarks));
	}, [bookmarks]);
	useEffect(() => {
		localStorage.setItem(STORAGE_COMPLETED, JSON.stringify(completedSurahs));
	}, [completedSurahs]);
	useEffect(() => {
		localStorage.setItem(STORAGE_RECENT, JSON.stringify(recentPaths));
	}, [recentPaths]);

	// Scan configured folders + files in Rust
	const refreshLibrary = useCallback(async (scanFolders: string[], scanFiles: string[]) => {
		if (scanFolders.length === 0 && scanFiles.length === 0) {
			setTracks([]);
			return;
		}
		setIsScanning(true);
		try {
			const rawList = await invoke<RawScannedTrack[]>("scan_quran_paths", {
				paths: [...scanFolders, ...scanFiles]
			});
			const seen = new Set<string>();
			const enriched: QuranTrack[] = [];
			for (const r of rawList) {
				if (seen.has(r.path)) continue;
				seen.add(r.path);
				enriched.push(enrichRawTrack(r));
			}
			enriched.sort((a, b) => {
				if (a.reciter !== b.reciter) return a.reciter.localeCompare(b.reciter, "ar");
				if (a.surahNumber && b.surahNumber) return a.surahNumber - b.surahNumber;
				if (a.surahNumber) return -1;
				if (b.surahNumber) return 1;
				return a.displayTitle.localeCompare(b.displayTitle, "ar");
			});
			setTracks(enriched);
		} catch (e) {
			console.error("Failed to scan Quran library:", e);
		} finally {
			setIsScanning(false);
		}
	}, []);

	useEffect(() => {
		refreshLibrary(folders, extraFiles);
	}, [folders, extraFiles, refreshLibrary]);

	const handleIngestDroppedPaths = useCallback(async (paths: string[]) => {
		try {
			const classified = await invoke<{ folders: string[]; files: string[] }>(
				"classify_dropped_paths",
				{ paths }
			);
			if (classified.folders.length > 0) {
				setFolders((prev) => Array.from(new Set([...prev, ...classified.folders])));
			}
			if (classified.files.length > 0) {
				setExtraFiles((prev) => Array.from(new Set([...prev, ...classified.files])));
			}
		} catch {
			setExtraFiles((prev) => Array.from(new Set([...prev, ...paths])));
		}
	}, []);

	const handleAddFolder = async () => {
		try {
			const selected = await openDialog({
				title: "اختر مجلد القرآن الكريم على جهازك",
				directory: true,
				multiple: true
			});
			if (!selected) return;
			const added = Array.isArray(selected) ? selected : [selected];
			setFolders((prev) => Array.from(new Set([...prev, ...added])));
		} catch (e) {
			console.error("Folder dialog error:", e);
		}
	};

	const handleAddFiles = async () => {
		try {
			const selected = await openDialog({
				title: "اختر ملفات التلاوات القرآنية",
				directory: false,
				multiple: true,
				filters: [
					{
						name: "تلاوات القرآن الكريم",
						extensions: ["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus", "wma", "webm"]
					}
				]
			});
			if (!selected) return;
			const added = Array.isArray(selected) ? selected : [selected];
			setExtraFiles((prev) => Array.from(new Set([...prev, ...added])));
		} catch (e) {
			console.error("File dialog error:", e);
		}
	};

	const handleAutoDiscover = async () => {
		setIsScanning(true);
		try {
			const foundFolders = await invoke<string[]>("auto_discover_quran_folders");
			if (foundFolders.length > 0) {
				setFolders((prev) => Array.from(new Set([...prev, ...foundFolders])));
			}
		} catch (e) {
			console.error("Auto-discover failed:", e);
		} finally {
			setIsScanning(false);
		}
	};

	// Broadcast state to Bloom's Dynamic Island ("main" window) via Rust
	const syncToDynamicIsland = useCallback(
		(track: QuranTrack | null, playing: boolean, posSec: number, durSec: number) => {
			if (!track) {
				invoke("sync_mathani_media", {
					info: {
						title: "",
						artist: "",
						is_playing: false,
						has_media: false,
						artwork: null,
						position_ms: 0,
						duration_ms: 0,
						seek_enabled: false,
						position_updated_at: Date.now()
					}
				}).catch(() => {});
				return;
			}

			invoke("sync_mathani_media", {
				info: {
					title: track.displayTitle,
					artist: track.reciter,
					is_playing: playing,
					has_media: true,
					artwork: [track.artworkUrl],
					position_ms: Math.round(posSec * 1000),
					duration_ms: Math.round((durSec || 0) * 1000),
					seek_enabled: durSec > 0,
					position_updated_at: Date.now()
				}
			}).catch(() => {});
		},
		[]
	);

	// Filtered & Displayed Tracks
	const filteredTracks = useMemo(() => {
		const q = normalizeArabic(searchQuery);
		return tracks.filter((t) => {
			if (selectedReciterFilter && t.reciter !== selectedReciterFilter) return false;
			if (libraryFilter === "meccan" && t.revelationType !== "meccan") return false;
			if (libraryFilter === "medinan" && t.revelationType !== "medinan") return false;
			if (libraryFilter === "favorites" && !favorites.includes(t.path)) return false;
			if (libraryFilter === "recent" && !recentPaths.includes(t.path)) return false;

			if (!q) return true;
			const numMatch = t.surahNumber ? String(t.surahNumber) === q || toArabicDigits(t.surahNumber) === q : false;
			const haystack = normalizeArabic(`${t.displayTitle} ${t.reciter} ${t.fileName}`);
			return numMatch || haystack.includes(q);
		});
	}, [tracks, selectedReciterFilter, libraryFilter, favorites, recentPaths, searchQuery]);

	const recitersSummary = useMemo(() => {
		const map = new Map<string, QuranTrack[]>();
		for (const t of tracks) {
			const list = map.get(t.reciter) ?? [];
			list.push(t);
			map.set(t.reciter, list);
		}
		return Array.from(map.entries()).map(([reciter, list]) => ({
			reciter,
			tracks: list,
			artwork: list[0]?.artworkUrl ?? buildSurahArtwork(1, "الفاتحة", reciter)
		}));
	}, [tracks]);

	// Play specific track
	const playTrack = useCallback(
		(track: QuranTrack, startAtSec = 0) => {
			const audio = audioRef.current;
			if (!audio) return;

			setCurrentTrack(track);
			setLoopPointA(null);
			setLoopPointB(null);
			setLoopDoneCount(0);

			setRecentPaths((prev) => [track.path, ...prev.filter((p) => p !== track.path)].slice(0, 35));

			const streamUrl = buildAudioStreamUrl(track.path);
			if (audio.src !== streamUrl) {
				audio.src = streamUrl;
				audio.load();
			}
			audio.playbackRate = playbackRate;
			audio.preservesPitch = true;
			audio.volume = playerVolume;

			const onLoaded = () => {
				if (startAtSec > 0 && startAtSec < (audio.duration || Infinity)) {
					audio.currentTime = startAtSec;
				}
				audio
					.play()
					.then(() => {
						setIsPlaying(true);
						syncToDynamicIsland(track, true, audio.currentTime, audio.duration || 0);
					})
					.catch((e) => console.error("Playback start error:", e));
			};

			if (audio.readyState >= 1) {
				onLoaded();
			} else {
				audio.addEventListener("loadedmetadata", onLoaded, { once: true });
			}

			// Ask Rust for embedded ID3 APIC cover if not yet loaded
			invoke<string | null>("get_track_embedded_artwork", { path: track.path })
				.then((art) => {
					if (art && art.startsWith("data:image/")) {
						setTracks((prev) =>
							prev.map((item) => (item.path === track.path ? { ...item, artworkUrl: art } : item))
						);
						setCurrentTrack((curr) =>
							curr && curr.path === track.path ? { ...curr, artworkUrl: art } : curr
						);
					}
				})
				.catch(() => {});
		},
		[playbackRate, playerVolume, syncToDynamicIsland]
	);

	const togglePlayPause = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;
		if (!currentTrack) {
			if (filteredTracks.length > 0) playTrack(filteredTracks[0]);
			else if (tracks.length > 0) playTrack(tracks[0]);
			return;
		}
		if (audio.paused) {
			audio
				.play()
				.then(() => {
					setIsPlaying(true);
					syncToDynamicIsland(currentTrack, true, audio.currentTime, audio.duration || durationSec);
				})
				.catch(() => {});
		} else {
			audio.pause();
			setIsPlaying(false);
			syncToDynamicIsland(currentTrack, false, audio.currentTime, audio.duration || durationSec);
		}
	}, [currentTrack, filteredTracks, tracks, playTrack, durationSec, syncToDynamicIsland]);

	const playAdjacent = useCallback(
		(dir: 1 | -1) => {
			const pool = filteredTracks.length > 0 ? filteredTracks : tracks;
			if (pool.length === 0) return;
			if (!currentTrack) {
				playTrack(pool[0]);
				return;
			}
			const idx = pool.findIndex((t) => t.path === currentTrack.path);
			const nextIdx = idx === -1 ? 0 : (idx + dir + pool.length) % pool.length;
			playTrack(pool[nextIdx]);
		},
		[filteredTracks, tracks, currentTrack, playTrack]
	);

	const animatePrev = useCallback(async () => {
		prevFront.set({ x: 0 });
		prevBack.set({ x: 28 });
		prevFront.start({ x: -28, transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } });
		await prevBack.start({ x: 0, transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } });
		playAdjacent(-1);
	}, [playAdjacent, prevFront, prevBack]);

	const animateNext = useCallback(async () => {
		nextFront.set({ x: 0 });
		nextBack.set({ x: -28 });
		nextFront.start({ x: 28, transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } });
		await nextBack.start({ x: 0, transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } });
		playAdjacent(1);
	}, [playAdjacent, nextFront, nextBack]);

	// Listen for instant local commands coming from Bloom's Dynamic Island!
	const latestControlsRef = useRef({ togglePlayPause, playAdjacent, currentTrack, durationSec });
	latestControlsRef.current = { togglePlayPause, playAdjacent, currentTrack, durationSec };

	useEffect(() => {
		const unlisten = listen<MathaniCommandPayload>("mathani-player-cmd", (event) => {
			const { action, position_ms } = event.payload;
			const { togglePlayPause: toggle, playAdjacent: adj, currentTrack: trk } =
				latestControlsRef.current;
			if (action === "play-pause") {
				toggle();
			} else if (action === "next") {
				adj(1);
			} else if (action === "previous") {
				adj(-1);
			} else if (action === "seek" && typeof position_ms === "number" && audioRef.current) {
				const targetSec = Math.max(0, position_ms / 1000);
				audioRef.current.currentTime = targetSec;
				setCurrentTimeSec(targetSec);
				if (trk) {
					syncToDynamicIsland(
						trk,
						!audioRef.current.paused,
						targetSec,
						audioRef.current.duration || 0
					);
				}
			}
		});
		return () => {
			unlisten.then((f) => f());
		};
	}, [syncToDynamicIsland]);

	// Web MediaSession integration for hardware keyboard media keys
	useEffect(() => {
		if (!("mediaSession" in navigator) || !currentTrack) return;
		try {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: currentTrack.displayTitle,
				artist: currentTrack.reciter,
				album: "القرآن الكريم — مثاني"
			});
			navigator.mediaSession.setActionHandler("play", () => latestControlsRef.current.togglePlayPause());
			navigator.mediaSession.setActionHandler("pause", () => latestControlsRef.current.togglePlayPause());
			navigator.mediaSession.setActionHandler("previoustrack", () =>
				latestControlsRef.current.playAdjacent(-1)
			);
			navigator.mediaSession.setActionHandler("nexttrack", () =>
				latestControlsRef.current.playAdjacent(1)
			);
		} catch {}
	}, [currentTrack]);

	// Sleep Timer countdown with gentle volume fade
	useEffect(() => {
		if (sleepMode !== "minutes" || sleepRemainingSec <= 0 || !isPlaying) return;
		const timer = setInterval(() => {
			setSleepRemainingSec((prev) => {
				if (prev <= 1) {
					if (audioRef.current) {
						audioRef.current.pause();
						audioRef.current.volume = playerVolume;
					}
					setIsPlaying(false);
					setSleepMode("off");
					if (currentTrack && audioRef.current) {
						syncToDynamicIsland(
							currentTrack,
							false,
							audioRef.current.currentTime,
							audioRef.current.duration || 0
						);
					}
					return 0;
				}
				if (prev <= 6 && audioRef.current) {
					audioRef.current.volume = Math.max(0.05, (playerVolume * (prev - 1)) / 6);
				}
				return prev - 1;
			});
		}, 1000);
		return () => clearInterval(timer);
	}, [sleepMode, sleepRemainingSec, isPlaying, playerVolume, currentTrack, syncToDynamicIsland]);

	// Audio element event handlers
	const lastSessionWriteRef = useRef(0);
	const handleTimeUpdate = () => {
		const audio = audioRef.current;
		if (!audio || !currentTrack) return;
		const nowSec = audio.currentTime;
		const durSec = audio.duration || 0;
		setCurrentTimeSec(nowSec);
		if (durSec > 0 && durSec !== durationSec) setDurationSec(durSec);

		// A-B Memorization Loop check
		if (loopPointA !== null && loopPointB !== null && loopPointB > loopPointA + 0.5) {
			if (nowSec >= loopPointB) {
				if (loopMaxRepeats === 0 || loopDoneCount + 1 < loopMaxRepeats) {
					audio.currentTime = loopPointA;
					setLoopDoneCount((c) => c + 1);
					syncToDynamicIsland(currentTrack, !audio.paused, loopPointA, durSec);
					return;
				} else {
					setLoopPointA(null);
					setLoopPointB(null);
					setLoopDoneCount(0);
				}
			}
		}

		// Save session & sync Dynamic Island every ~2.5s
		const nowMs = Date.now();
		if (nowMs - lastSessionWriteRef.current > 2500) {
			lastSessionWriteRef.current = nowMs;
			localStorage.setItem(
				STORAGE_LAST_SESSION,
				JSON.stringify({ path: currentTrack.path, positionSec: Math.floor(nowSec) })
			);
			syncToDynamicIsland(currentTrack, !audio.paused, nowSec, durSec);
		}
	};

	const handleTrackEnded = () => {
		if (currentTrack?.surahNumber) {
			setCompletedSurahs((prev) =>
				prev.includes(currentTrack.surahNumber!) ? prev : [...prev, currentTrack.surahNumber!]
			);
		}

		if (sleepMode === "end-of-surah") {
			setIsPlaying(false);
			setSleepMode("off");
			if (currentTrack) syncToDynamicIsland(currentTrack, false, 0, durationSec);
			return;
		}

		if (repeatMode === "one" && currentTrack) {
			playTrack(currentTrack, 0);
		} else if (repeatMode === "sequence") {
			playAdjacent(1);
		} else {
			setIsPlaying(false);
			if (currentTrack) syncToDynamicIsland(currentTrack, false, durationSec, durationSec);
		}
	};

	const toggleFavorite = (path: string, e?: React.MouseEvent) => {
		e?.stopPropagation();
		setFavorites((prev) =>
			prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
		);
	};

	const handleAddBookmark = () => {
		if (!currentTrack) return;
		const item: BookmarkItem = {
			id: `${Date.now()}`,
			trackPath: currentTrack.path,
			surahTitle: currentTrack.displayTitle,
			reciter: currentTrack.reciter,
			positionSec: Math.floor(currentTimeSec),
			note: bookmarkNote.trim() || `موضع عند الدقيقة ${formatDuration(currentTimeSec)}`,
			createdAt: Date.now()
		};
		setBookmarks((prev) => [item, ...prev]);
		setBookmarkNote("");
	};

	const jumpToBookmark = (b: BookmarkItem) => {
		const found = tracks.find((t) => t.path === b.trackPath);
		if (found) {
			playTrack(found, b.positionSec);
		}
	};

	const resumeTrackObj = useMemo(() => {
		if (!savedSession) return null;
		return tracks.find((t) => t.path === savedSession.path) ?? null;
	}, [savedSession, tracks]);

	const progressPct = durationSec > 0 ? Math.min(100, (currentTimeSec / durationSec) * 100) : 0;
	const abLeftPct =
		loopPointA !== null && durationSec > 0 ? Math.min(100, (loopPointA / durationSec) * 100) : null;
	const abWidthPct =
		loopPointA !== null && loopPointB !== null && durationSec > 0
			? Math.max(0.5, ((loopPointB - loopPointA) / durationSec) * 100)
			: null;

	return (
		<div
			className={`mathani-shell${isMaximized ? " maximized" : ""}${isDragHover ? " drag-active" : ""}`}
			dir="rtl"
		>
			<audio
				ref={audioRef}
				preload="metadata"
				onTimeUpdate={handleTimeUpdate}
				onLoadedMetadata={(e) => {
					const dur = e.currentTarget.duration || 0;
					setDurationSec(dur);
					if (currentTrack) {
						syncToDynamicIsland(currentTrack, !e.currentTarget.paused, e.currentTarget.currentTime, dur);
					}
				}}
				onPlay={() => {
					setIsPlaying(true);
					if (currentTrack && audioRef.current) {
						syncToDynamicIsland(
							currentTrack,
							true,
							audioRef.current.currentTime,
							audioRef.current.duration || durationSec
						);
					}
				}}
				onPause={() => {
					setIsPlaying(false);
					if (currentTrack && audioRef.current) {
						syncToDynamicIsland(
							currentTrack,
							false,
							audioRef.current.currentTime,
							audioRef.current.duration || durationSec
						);
					}
				}}
				onEnded={handleTrackEnded}
			/>

			{currentTrack && (
				<div className="mathani-ambient-backdrop" aria-hidden="true">
					<img src={currentTrack.artworkUrl} alt="" />
				</div>
			)}

			{/* Custom Bloom-inspired Frameless Titlebar */}
			<header className="m-titlebar" data-tauri-drag-region>
				<div className="m-brand">
					<div className="m-brand-logo">
						<MusicNoteIcon size={17} />
					</div>
					<div className="m-brand-text">
						<span className="m-brand-name">مَثَانِي</span>
						<span className="m-brand-sub">مشغل القرآن الكريم المكتبي</span>
					</div>
				</div>

				<button
					className="m-island-status-pill"
					onClick={() => setActiveNav("island")}
					title="إعدادات الجزيرة التفاعلية العلوية"
				>
					<span className="m-island-dot" />
					<span>الجزيرة التفاعلية نشطة في الأعلى</span>
				</button>

				<div className="m-search-box">
					<Search size={14} className="m-search-icon" />
					<input
						type="text"
						placeholder="ابحث باسم السورة، رقمها، أو اسم القارئ..."
						value={searchQuery}
						onChange={(e) => {
							setSearchQuery(e.target.value);
							if (activeNav !== "library") setActiveNav("library");
						}}
					/>
					{searchQuery && (
						<button className="m-search-clear" onClick={() => setSearchQuery("")} title="مسح البحث">
							<X size={11} />
						</button>
					)}
				</div>

				<div className="m-win-actions">
					<button
						className="m-island-min-btn"
						onClick={() => appWindow.hide().catch(() => {})}
						title="إخفاء النافذة والاكتفاء بالجزيرة التفاعلية أعلى سطح المكتب"
					>
						<PanelTop size={13} />
						<span>الجزيرة فقط</span>
					</button>
					<button
						className="m-win-btn"
						onClick={() => appWindow.minimize().catch(() => {})}
						title="تصغير لشريط المهام"
					>
						<Minus size={13} />
					</button>
					<button
						className="m-win-btn"
						onClick={() => appWindow.toggleMaximize().catch(() => {})}
						title="تكبير / استعادة"
					>
						<Square size={11} />
					</button>
					<button
						className="m-win-btn close"
						onClick={() => appWindow.hide().catch(() => {})}
						title="تصغير إلى الخلفية والجزيرة التفاعلية"
					>
						<X size={13} />
					</button>
				</div>
			</header>

			{/* Main Split Workspace */}
			<div className="m-workspace">
				<aside className="m-sidebar">
					<div className="m-nav-group">
						<div className="m-nav-label">المصحف الصوتي</div>
						<button
							className={`m-nav-btn ${activeNav === "library" && !selectedReciterFilter ? "active" : ""}`}
							onClick={() => {
								setSelectedReciterFilter(null);
								setActiveNav("library");
							}}
						>
							<span className="m-nav-btn-right">
								<BookOpen size={15} />
								<span>المكتبة القرآنية</span>
							</span>
							<span className="m-nav-badge">{toArabicDigits(tracks.length)}</span>
						</button>

						<button
							className={`m-nav-btn ${activeNav === "reciters" ? "active" : ""}`}
							onClick={() => setActiveNav("reciters")}
						>
							<span className="m-nav-btn-right">
								<Users size={15} />
								<span>القُرّاء والمصاحف</span>
							</span>
							<span className="m-nav-badge">{toArabicDigits(recitersSummary.length)}</span>
						</button>

						<div className="m-nav-label">أدوات التدبر والحفظ</div>
						<button
							className={`m-nav-btn ${activeNav === "memorize" ? "active" : ""}`}
							onClick={() => setActiveNav("memorize")}
						>
							<span className="m-nav-btn-right">
								<Repeat size={15} />
								<span>التحفيظ والعلامات</span>
							</span>
							{bookmarks.length > 0 && (
								<span className="m-nav-badge">{toArabicDigits(bookmarks.length)}</span>
							)}
						</button>

						<button
							className={`m-nav-btn ${activeNav === "khatmah" ? "active" : ""}`}
							onClick={() => setActiveNav("khatmah")}
						>
							<span className="m-nav-btn-right">
								<History size={15} />
								<span>الختمة والسجل</span>
							</span>
							<span className="m-nav-badge">{toArabicDigits(completedSurahs.length)}/١١٤</span>
						</button>

						<div className="m-nav-label">الإدارة والتخصيص</div>
						<button
							className={`m-nav-btn ${activeNav === "folders" ? "active" : ""}`}
							onClick={() => setActiveNav("folders")}
						>
							<span className="m-nav-btn-right">
								<FolderOpen size={15} />
								<span>مجلدات القرآن</span>
							</span>
						</button>

						<button
							className={`m-nav-btn ${activeNav === "island" ? "active" : ""}`}
							onClick={() => setActiveNav("island")}
						>
							<span className="m-nav-btn-right">
								<Sparkles size={15} />
								<span>الجزيرة والمظهر</span>
							</span>
						</button>
					</div>

					{/* Khatmah Progress Card in Sidebar */}
					<div className="m-sidebar-card">
						<div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
							<span style={{ fontWeight: 700 }}>تقدم الختمة السماعية</span>
							<span style={{ color: "var(--m-accent)", fontWeight: 700 }}>
								{toArabicDigits(Math.round((completedSurahs.length / 114) * 100))}%
							</span>
						</div>
						<div className="m-khatmah-bar">
							<div
								className="m-khatmah-fill"
								style={{ width: `${Math.min(100, (completedSurahs.length / 114) * 100)}%` }}
							/>
						</div>
						<span style={{ fontSize: 10.5, color: "var(--m-muted)" }}>
							أتممت الاستماع إلى {toArabicDigits(completedSurahs.length)} من أصل ١١٤ سورة
						</span>
					</div>
				</aside>

				{/* Main Dynamic View */}
				<main className="m-content">
					{activeNav === "library" && (
						<>
							{/* Resume / Active Hero Card */}
							{(currentTrack || resumeTrackObj) && (
								<div className="m-hero">
									<div className="m-hero-info">
										<div className="m-hero-art">
											<img
												src={(currentTrack ?? resumeTrackObj)!.artworkUrl}
												alt=""
												draggable={false}
											/>
										</div>
										<div className="m-hero-text">
											<span className="m-hero-eyebrow">
												{currentTrack ? "التلاوة الجارية الآن • متزامن مع الجزيرة التفاعلية" : "استئناف آخر تلاوة"}
											</span>
											<h2 className="m-hero-title">
												{(currentTrack ?? resumeTrackObj)!.displayTitle}
											</h2>
											<span className="m-hero-sub">
												{(currentTrack ?? resumeTrackObj)!.reciter}
												{(currentTrack ?? resumeTrackObj)!.ayahs
													? ` • ${toArabicDigits((currentTrack ?? resumeTrackObj)!.ayahs!)} آية • الجزء ${toArabicDigits((currentTrack ?? resumeTrackObj)!.juz!)}`
													: ""}
											</span>
										</div>
									</div>

									<div className="m-hero-actions">
										{!currentTrack && resumeTrackObj && savedSession ? (
											<button
												className="m-btn-primary"
												onClick={() => playTrack(resumeTrackObj, savedSession.positionSec)}
											>
												<Play size={15} fill="currentColor" />
												<span>استئناف من {formatDuration(savedSession.positionSec)}</span>
											</button>
										) : (
											<button className="m-btn-primary" onClick={togglePlayPause}>
												{isPlaying ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
												<span>{isPlaying ? "إيقاف مؤقت" : "مواصلة التلاوة"}</span>
											</button>
										)}
										<button className="m-btn-secondary" onClick={handleAddFolder}>
											<FolderPlus size={14} />
											<span>إضافة مجلد</span>
										</button>
									</div>
								</div>
							)}

							{/* Filter Chips & Actions */}
							<div className="m-toolbar">
								<div className="m-chips">
									{selectedReciterFilter && (
										<button
											className="m-chip active"
											onClick={() => setSelectedReciterFilter(null)}
										>
											<span>القارئ: {selectedReciterFilter}</span>
											<X size={12} />
										</button>
									)}
									{(
										[
											["all", "جميع السور"],
											["meccan", "السور المكية"],
											["medinan", "السور المدنية"],
											["favorites", "المفضلة"],
											["recent", "المستمع إليها مؤخراً"]
										] as const
									).map(([id, label]) => (
										<button
											key={id}
											className={`m-chip ${libraryFilter === id ? "active" : ""}`}
											onClick={() => setLibraryFilter(id)}
										>
											{label}
										</button>
									))}
								</div>

								<div style={{ display: "flex", gap: 6 }}>
									<button className="m-btn-secondary" onClick={handleAddFolder}>
										<FolderPlus size={14} />
										<span>إضافة مجلد قرآني</span>
									</button>
									<button className="m-btn-secondary" onClick={handleAddFiles}>
										<FileAudio size={14} />
										<span>إضافة تلاوات</span>
									</button>
								</div>
							</div>

							{/* Track List or Onboarding Empty State */}
							{tracks.length === 0 ? (
								<div className="m-empty">
									<div className="m-empty-icon">
										<BookOpen size={30} />
									</div>
									<h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
										أهلاً بك في مَثَانِي — مشغل القرآن الكريم الاحترافي
									</h3>
									<p
										style={{
											margin: 0,
											maxWidth: 480,
											fontSize: 13,
											lineHeight: 1.65,
											color: "var(--m-muted)"
										}}
									>
										اختر مجلد القرآن الكريم الموجود على جهازك أو اسحب الملفات وأفلتها هنا، وسيقوم
										مثاني بالتعرف تلقائياً على أسماء السور الـ ١١٤ والقراء وربط التلاوة مباشرةً
										بالجزيرة التفاعلية أعلى سطح المكتب.
									</p>
									<div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
										<button className="m-btn-primary" onClick={handleAddFolder}>
											<FolderPlus size={16} />
											<span>اختيار مجلد القرآن الكريم</span>
										</button>
										<button className="m-btn-secondary" onClick={handleAutoDiscover} disabled={isScanning}>
											<Compass size={15} />
											<span>{isScanning ? "جارٍ البحث..." : "اكتشاف مجلدات القرآن تلقائياً"}</span>
										</button>
										<button className="m-btn-secondary" onClick={handleAddFiles}>
											<FileAudio size={15} />
											<span>اختيار ملفات صوتية</span>
										</button>
									</div>
								</div>
							) : filteredTracks.length === 0 ? (
								<div className="m-empty">
									<span style={{ fontSize: 14, color: "var(--m-muted)" }}>
										لا توجد سور مطابقة لمعايير التصفية أو البحث الحالية.
									</span>
								</div>
							) : (
								<div className="m-surah-list">
									{filteredTracks.map((track, i) => {
										const active = currentTrack?.path === track.path;
										const fav = favorites.includes(track.path);
										return (
											<div
												key={track.path}
												className={`m-surah-row ${active ? "playing" : ""}`}
												onClick={() => playTrack(track)}
											>
												<div className="m-surah-num">
													{active && isPlaying ? (
														<PlayerVisualizer isPlaying={true} />
													) : (
														toArabicDigits(track.surahNumber ?? i + 1)
													)}
												</div>

												<div className="m-surah-main">
													<img
														src={track.artworkUrl}
														alt=""
														className="m-surah-thumb"
														draggable={false}
													/>
													<div className="m-surah-titles">
														<span className="m-surah-name">{track.displayTitle}</span>
														<span className="m-surah-sub">
															{track.ayahs
																? `${toArabicDigits(track.ayahs)} آية • الجزء ${toArabicDigits(track.juz!)}`
																: track.fileName}
														</span>
													</div>
												</div>

												<div className="m-surah-reciter">{track.reciter}</div>

												<div className="m-surah-badges">
													{track.revelationType && (
														<span className={`m-tag ${track.revelationType}`}>
															{track.revelationType === "meccan" ? "مكية" : "مدنية"}
														</span>
													)}
													{track.surahNumber && completedSurahs.includes(track.surahNumber) && (
														<CheckCircle2 size={14} color="#34d399" />
													)}
												</div>

												<div className="m-surah-actions">
													<button
														className={`m-icon-btn ${fav ? "fav-active" : ""}`}
														onClick={(e) => toggleFavorite(track.path, e)}
														title={fav ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
													>
														<Heart size={15} fill={fav ? "currentColor" : "none"} />
													</button>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</>
					)}

					{activeNav === "reciters" && (
						<>
							<div className="m-toolbar">
								<h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>القُرّاء والمصاحف الصوتية</h2>
								<button className="m-btn-secondary" onClick={handleAddFolder}>
									<FolderPlus size={14} />
									<span>إضافة مصحف لقارئ جديد</span>
								</button>
							</div>
							{recitersSummary.length === 0 ? (
								<div className="m-empty">
									<span style={{ color: "var(--m-muted)", fontSize: 13.5 }}>
										أضف مجلدات التلاوات ليتم تصنيف القراء والمصاحف تلقائياً.
									</span>
								</div>
							) : (
								<div className="m-grid">
									{recitersSummary.map((item) => (
										<div
											key={item.reciter}
											className="m-card"
											onClick={() => {
												setSelectedReciterFilter(item.reciter);
												setActiveNav("library");
											}}
										>
											<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
												<img
													src={item.artwork}
													alt=""
													style={{ width: 52, height: 52, borderRadius: 12, objectFit: "cover" }}
												/>
												<div style={{ minWidth: 0 }}>
													<div
														style={{
															fontSize: 14,
															fontWeight: 700,
															whiteSpace: "nowrap",
															overflow: "hidden",
															textOverflow: "ellipsis"
														}}
													>
														{item.reciter}
													</div>
													<div style={{ fontSize: 11.5, color: "var(--m-muted)", marginTop: 2 }}>
														{toArabicDigits(item.tracks.length)} سورة وتلاوة متاحة
													</div>
												</div>
											</div>
											<button
												className="m-btn-secondary"
												style={{ alignSelf: "flex-start" }}
												onClick={(e) => {
													e.stopPropagation();
													if (item.tracks.length > 0) playTrack(item.tracks[0]);
												}}
											>
												<Play size={13} fill="currentColor" />
												<span>بدء تلاوة المصحف</span>
											</button>
										</div>
									))}
								</div>
							)}
						</>
					)}

					{activeNav === "memorize" && (
						<>
							<h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
								استوديو التحفيظ وتكرار المقاطع والعلامات المرجعية
							</h2>

							<div className="m-panel-card">
								<h3 className="m-panel-title">
									<Repeat size={16} color="var(--m-accent)" />
									<span>تكرار مقطع الحفظ والمراجعة (A–B Repeat)</span>
								</h3>
								<p style={{ margin: 0, fontSize: 12, color: "var(--m-muted)" }}>
									حدّد بداية المقطع (أ) ونهايته (ب) أثناء الاستماع لتكرار الآيات تلقائياً وتثبيت الحفظ.
								</p>
								<div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
									<button
										className="m-btn-secondary"
										disabled={!currentTrack}
										onClick={() => setLoopPointA(currentTimeSec)}
									>
										<span>
											تحديد البداية (أ): {loopPointA !== null ? formatDuration(loopPointA) : "غير محدد"}
										</span>
									</button>
									<button
										className="m-btn-secondary"
										disabled={!currentTrack || loopPointA === null}
										onClick={() => {
											if (loopPointA !== null && currentTimeSec > loopPointA + 0.5) {
												setLoopPointB(currentTimeSec);
												setLoopDoneCount(0);
											}
										}}
									>
										<span>
											تحديد النهاية (ب): {loopPointB !== null ? formatDuration(loopPointB) : "غير محدد"}
										</span>
									</button>

									{[0, 3, 5, 10].map((cnt) => (
										<button
											key={cnt}
											className={`m-chip ${loopMaxRepeats === cnt ? "active" : ""}`}
											onClick={() => setLoopMaxRepeats(cnt)}
										>
											{cnt === 0 ? "تكرار مفتوح ∞" : `${toArabicDigits(cnt)} مرات`}
										</button>
									))}

									{(loopPointA !== null || loopPointB !== null) && (
										<button
											className="m-btn-secondary"
											onClick={() => {
												setLoopPointA(null);
												setLoopPointB(null);
												setLoopDoneCount(0);
											}}
										>
											<X size={13} />
											<span>إلغاء التكرار</span>
										</button>
									)}
								</div>
							</div>

							<div className="m-panel-card">
								<h3 className="m-panel-title">
									<Bookmark size={16} color="var(--m-accent)" />
									<span>العلامات المرجعية القرآنية</span>
								</h3>
								<div style={{ display: "flex", gap: 8 }}>
									<input
										type="text"
										placeholder="اكتب ملاحظة للعلامة (مثال: آية الكرسي / موضع الحفظ)..."
										value={bookmarkNote}
										onChange={(e) => setBookmarkNote(e.target.value)}
										style={{
											flex: 1,
											height: 35,
											borderRadius: 999,
											border: "1px solid var(--m-border)",
											background: "rgba(255,255,255,0.04)",
											color: "var(--m-text)",
											padding: "0 14px",
											fontFamily: "inherit",
											fontSize: 12.5,
											outline: "none"
										}}
									/>
									<button
										className="m-btn-primary"
										disabled={!currentTrack}
										onClick={handleAddBookmark}
									>
										<Bookmark size={14} />
										<span>حفظ الموضع الحالي ({formatDuration(currentTimeSec)})</span>
									</button>
								</div>

								{bookmarks.length === 0 ? (
									<span style={{ fontSize: 12, color: "var(--m-muted)" }}>
										لا توجد علامات مرجعية محفوظة بعد.
									</span>
								) : (
									<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
										{bookmarks.map((b) => (
											<div
												key={b.id}
												style={{
													display: "flex",
													alignItems: "center",
													justifyContent: "space-between",
													padding: "9px 12px",
													borderRadius: 10,
													background: "rgba(255,255,255,0.04)",
													border: "1px solid var(--m-border)"
												}}
											>
												<div
													style={{ cursor: "pointer", flex: 1 }}
													onClick={() => jumpToBookmark(b)}
												>
													<div style={{ fontSize: 13, fontWeight: 700 }}>
														{b.surahTitle} — {b.note}
													</div>
													<div style={{ fontSize: 11, color: "var(--m-muted)" }}>
														{b.reciter} • عند الدقيقة {formatDuration(b.positionSec)}
													</div>
												</div>
												<button
													className="m-icon-btn"
													onClick={() =>
														setBookmarks((prev) => prev.filter((x) => x.id !== b.id))
													}
													title="حذف العلامة"
												>
													<Trash2 size={14} />
												</button>
											</div>
										))}
									</div>
								)}
							</div>
						</>
					)}

					{activeNav === "khatmah" && (
						<>
							<div className="m-toolbar">
								<h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
									متابعة الختمة السماعية ({toArabicDigits(completedSurahs.length)} / ١١٤ سورة)
								</h2>
								{completedSurahs.length > 0 && (
									<button
										className="m-btn-secondary"
										onClick={() => setCompletedSurahs([])}
									>
										<span>بدء ختمة جديدة</span>
									</button>
								)}
							</div>
							<div
								style={{
									display: "grid",
									gridTemplateColumns: "repeat(auto-fill, minmax(125px, 1fr))",
									gap: 8
								}}
							>
								{SURAHS.map((s) => {
									const done = completedSurahs.includes(s.number);
									const availableTrack = tracks.find((t) => t.surahNumber === s.number);
									return (
										<div
											key={s.number}
											onClick={() => {
												if (availableTrack) playTrack(availableTrack);
												else {
													setCompletedSurahs((prev) =>
														prev.includes(s.number)
															? prev.filter((n) => n !== s.number)
															: [...prev, s.number]
													);
												}
											}}
											style={{
												padding: "9px 11px",
												borderRadius: 11,
												background: done
													? "color-mix(in srgb, var(--m-accent) 18%, var(--m-group))"
													: "var(--m-group)",
												border: `1px solid ${done ? "var(--m-accent)" : "var(--m-border)"}`,
												cursor: "pointer",
												display: "flex",
												alignItems: "center",
												justifyContent: "space-between",
												opacity: availableTrack || done ? 1 : 0.65
											}}
											title={
												availableTrack
													? `اضغط لتشغيل سورة ${s.name}`
													: "اضغط لتعليم السورة كمكتملة"
											}
										>
											<span style={{ fontSize: 12.5, fontWeight: 700 }}>
												{toArabicDigits(s.number)}. {s.name}
											</span>
											{done && <CheckCircle2 size={14} color="var(--m-accent)" />}
										</div>
									);
								})}
							</div>
						</>
					)}

					{activeNav === "folders" && (
						<>
							<div className="m-toolbar">
								<h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
									مجلدات ومصادر القرآن الكريم على جهازك
								</h2>
								<div style={{ display: "flex", gap: 8 }}>
									<button className="m-btn-primary" onClick={handleAddFolder}>
										<FolderPlus size={15} />
										<span>إضافة مجلد</span>
									</button>
									<button
										className="m-btn-secondary"
										onClick={() => refreshLibrary(folders, extraFiles)}
									>
										<RefreshCw size={14} />
										<span>إعادة فحص المكتبة</span>
									</button>
								</div>
							</div>

							<div className="m-panel-card">
								<h3 className="m-panel-title">المجلدات المربوطة ({toArabicDigits(folders.length)})</h3>
								{folders.length === 0 ? (
									<span style={{ fontSize: 12.5, color: "var(--m-muted)" }}>
										لم تقم بإضافة مجلدات بعد. اضغط «إضافة مجلد» أو «اكتشاف تلقائي».
									</span>
								) : (
									folders.map((dir) => (
										<div
											key={dir}
											style={{
												display: "flex",
												alignItems: "center",
												justifyContent: "space-between",
												padding: "9px 12px",
												borderRadius: 10,
												background: "rgba(255,255,255,0.04)",
												border: "1px solid var(--m-border)"
											}}
										>
											<span style={{ fontSize: 12.5, direction: "ltr" }}>{dir}</span>
											<button
												className="m-icon-btn"
												onClick={() => setFolders((prev) => prev.filter((f) => f !== dir))}
												title="إزالة المجلد من المكتبة"
											>
												<Trash2 size={14} />
											</button>
										</div>
									))
								)}

								{extraFiles.length > 0 && (
									<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6 }}>
										<span style={{ fontSize: 12, color: "var(--m-muted)" }}>
											ملفات منفردة مضافة: {toArabicDigits(extraFiles.length)} ملف
										</span>
										<button className="m-btn-secondary" onClick={() => setExtraFiles([])}>
											مسح الملفات المنفردة
										</button>
									</div>
								)}
							</div>
						</>
					)}

					{activeNav === "island" && (
						<div className="rtl-settings" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
							<div className="m-panel-card">
								<h3 className="m-panel-title">
									<Sliders size={16} color="var(--m-accent)" />
									<span>سمات مثاني السريعة (تُطبَّق على المشغل والجزيرة التفاعلية معاً)</span>
								</h3>
								<div className="m-swatch-row">
									{THEME_PRESETS.map((preset) => (
										<button
											key={preset.hex}
											className={`m-swatch ${
												islandSettings.themeMode === "custom" &&
												islandSettings.themeColor.toLowerCase() === preset.hex
													? "active"
													: ""
											}`}
											onClick={() => {
												islandSettings.handleThemeModeChange("custom");
												islandSettings.handleThemeColorChange(preset.hex);
											}}
										>
											<span className="m-swatch-dot" style={{ background: preset.hex }} />
											<span>{preset.name}</span>
										</button>
									))}
									<button
										className={`m-swatch ${islandSettings.themeMode === "dark" ? "active" : ""}`}
										onClick={() => islandSettings.handleThemeModeChange("dark")}
									>
										<span className="m-swatch-dot" style={{ background: "#090a0d", border: "1px solid #555" }} />
										<span>أسود كلاسيكي (Bloom Dark)</span>
									</button>
								</div>
							</div>

							<NotchTab
								notchMode={islandSettings.notchMode}
								setNotchModeValue={islandSettings.setNotchModeValue}
								notchEdgeDelay={islandSettings.notchEdgeDelay}
								handleNotchEdgeDelayChange={islandSettings.handleNotchEdgeDelayChange}
								calendarEnabled={islandSettings.calendarEnabled}
								toggleCalendar={islandSettings.toggleCalendar}
								notchRememberPanel={islandSettings.notchRememberPanel}
								toggleNotchRememberPanel={islandSettings.toggleNotchRememberPanel}
								notchDefaultPanel={islandSettings.notchDefaultPanel}
								changeNotchDefaultPanel={islandSettings.changeNotchDefaultPanel}
								timerSoundEnabled={islandSettings.timerSoundEnabled}
								toggleTimerSound={islandSettings.toggleTimerSound}
								musicModeEnabled={islandSettings.musicModeEnabled}
								toggleMusicMode={islandSettings.toggleMusicMode}
								musicCompactNotch={islandSettings.musicCompactNotch}
								toggleMusicCompactNotch={islandSettings.toggleMusicCompactNotch}
								shelfPersist={islandSettings.shelfPersist}
								toggleShelfPersist={islandSettings.toggleShelfPersist}
								mediaLayout={islandSettings.mediaLayout}
								toggleMediaLayout={islandSettings.toggleMediaLayout}
								mediaAmbienceEnabled={islandSettings.mediaAmbienceEnabled}
								toggleAmbience={islandSettings.toggleAmbience}
								mediaCompactGlowEnabled={islandSettings.mediaCompactGlowEnabled}
								toggleCompactGlow={islandSettings.toggleCompactGlow}
								statusWidgets={islandSettings.statusWidgets}
								handleWidgetsChange={islandSettings.handleWidgetsChange}
							/>

							<AppearanceTab
								themeMode={islandSettings.themeMode}
								handleThemeModeChange={islandSettings.handleThemeModeChange}
								themeColor={islandSettings.themeColor}
								handleThemeColorChange={islandSettings.handleThemeColorChange}
								themeOpacity={islandSettings.themeOpacity}
								handleOpacityChange={islandSettings.handleOpacityChange}
								themeSaturation={islandSettings.themeSaturation}
								handleSaturationChange={islandSettings.handleSaturationChange}
								themeBrightness={islandSettings.themeBrightness}
								handleBrightnessChange={islandSettings.handleBrightnessChange}
								cornersEnabled={islandSettings.cornersEnabled}
								toggleCorners={islandSettings.toggleCorners}
								scale={islandSettings.scale}
								handleScaleChange={islandSettings.handleScaleChange}
							/>

							<GeneralTab
								autostart={islandSettings.autostart}
								toggleAutostart={islandSettings.toggleAutostart}
								timeFormat24h={islandSettings.timeFormat24h}
								toggleTimeFormat24h={islandSettings.toggleTimeFormat24h}
								lowBatteryThreshold={islandSettings.lowBatteryThreshold}
								handleThresholdChange={islandSettings.handleThresholdChange}
								restartBloom={islandSettings.restartBloom}
								resetToDefaults={islandSettings.resetToDefaults}
								quitBloom={islandSettings.quitBloom}
							/>
						</div>
					)}
				</main>
			</div>

			{/* Bottom Master Recitation Bar */}
			<footer className="m-player-bar">
				<div className="m-progress-row">
					<span className="m-time">{formatDuration(currentTimeSec)}</span>
					<div className="m-seek-track">
						<div className="m-seek-fill" style={{ width: `${progressPct}%` }} />
						{abLeftPct !== null && abWidthPct !== null && (
							<div
								className="m-seek-ab"
								style={{ left: `${abLeftPct}%`, width: `${abWidthPct}%` }}
							/>
						)}
						<input
							type="range"
							className="m-seek-input"
							min={0}
							max={durationSec || 100}
							step={0.25}
							disabled={!currentTrack || durationSec <= 0}
							value={currentTimeSec}
							onChange={(e) => {
								const nextSec = Number(e.target.value);
								setCurrentTimeSec(nextSec);
								if (audioRef.current) {
									audioRef.current.currentTime = nextSec;
									if (currentTrack) {
										syncToDynamicIsland(
											currentTrack,
											!audioRef.current.paused,
											nextSec,
											durationSec
										);
									}
								}
							}}
						/>
					</div>
					<span className="m-time">
						{durationSec > 0
							? `-${formatDuration(Math.max(0, durationSec - currentTimeSec))}`
							: "0:00"}
					</span>
				</div>

				<div className="m-controls-row">
					{/* Right Side (in RTL): Active Surah Metadata */}
					<div className="m-now-track">
						<div className="m-now-art">
							<AnimatePresence mode="wait" initial={false}>
								{currentTrack ? (
									<motion.img
										key={currentTrack.artworkUrl}
										src={currentTrack.artworkUrl}
										alt=""
										initial={{ rotateY: 90, opacity: 0 }}
										animate={{ rotateY: 0, opacity: 1 }}
										exit={{ rotateY: -90, opacity: 0 }}
										transition={{ duration: 0.25 }}
									/>
								) : (
									<MusicNoteIcon size={22} />
								)}
							</AnimatePresence>
						</div>
						<div className="m-now-meta">
							<span className="m-now-title">
								{currentTrack ? currentTrack.displayTitle : "لم يتم اختيار سورة بعد"}
							</span>
							<span className="m-now-reciter">
								{currentTrack ? currentTrack.reciter : "اختر سورة من المكتبة لبدء التلاوة المباركة"}
							</span>
						</div>
					</div>

					{/* Center: Bloom SF Transport Controls */}
					<div className="m-transport">
						<button
							className={`m-tbtn ${repeatMode !== "sequence" ? "active" : ""}`}
							onClick={() =>
								setRepeatMode((m) =>
									m === "sequence" ? "one" : m === "one" ? "off" : "sequence"
								)
							}
							title={
								repeatMode === "sequence"
									? "تسلسل السور تلقائياً"
									: repeatMode === "one"
										? "تكرار السورة الحالية"
										: "إيقاف عند نهاية السورة"
							}
						>
							<Repeat size={16} />
							{repeatMode === "one" && (
								<span style={{ fontSize: 9, fontWeight: 800, marginLeft: -2 }}>1</span>
							)}
						</button>

						<motion.button className="m-tbtn" whileTap={{ scale: 0.9 }} onClick={animatePrev} title="السورة السابقة">
							<div className="m-slide-wrap">
								<motion.div animate={prevBack} className="m-slide-layer">
									<SkipBackIcon size={24} />
								</motion.div>
								<motion.div animate={prevFront} className="m-slide-layer">
									<SkipBackIcon size={24} />
								</motion.div>
							</div>
						</motion.button>

						<motion.button
							className="m-play-circle"
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.94 }}
							onClick={togglePlayPause}
							title={isPlaying ? "إيقاف مؤقت" : "تشغيل التلاوة"}
						>
							{isPlaying ? <PauseIcon size={21} /> : <PlayIcon size={21} />}
						</motion.button>

						<motion.button className="m-tbtn" whileTap={{ scale: 0.9 }} onClick={animateNext} title="السورة التالية">
							<div className="m-slide-wrap">
								<motion.div animate={nextBack} className="m-slide-layer">
									<SkipForwardIcon size={24} />
								</motion.div>
								<motion.div animate={nextFront} className="m-slide-layer">
									<SkipForwardIcon size={24} />
								</motion.div>
							</div>
						</motion.button>

						<button
							className={`m-tbtn ${loopPointA !== null ? "active" : ""}`}
							onClick={() => setActiveNav("memorize")}
							title="تكرار الحفظ أ-ب والعلامات المرجعية"
						>
							<Bookmark size={16} />
						</button>
					</div>

					{/* Left Side (in RTL): Speed, Sleep Timer, Volume */}
					<div className="m-right-tools">
						<button
							className={`m-mini-pill ${playbackRate !== 1 ? "active" : ""}`}
							onClick={() => {
								const steps = [0.75, 0.9, 1.0, 1.1, 1.25, 1.5];
								const next = steps[(steps.indexOf(playbackRate) + 1) % steps.length] ?? 1.0;
								setPlaybackRate(next);
								if (audioRef.current) {
									audioRef.current.playbackRate = next;
									audioRef.current.preservesPitch = true;
								}
							}}
							title="سرعة التلاوة مع الحفاظ على طبقة الصوت"
						>
							<span>{playbackRate}x</span>
						</button>

						<button
							className={`m-mini-pill ${sleepMode !== "off" ? "active" : ""}`}
							onClick={() => {
								if (sleepMode === "off") {
									setSleepMode("minutes");
									setSleepRemainingSec(30 * 60);
								} else if (sleepMode === "minutes" && sleepRemainingSec > 15 * 60) {
									setSleepMode("end-of-surah");
									setSleepRemainingSec(0);
								} else {
									setSleepMode("off");
									setSleepRemainingSec(0);
									if (audioRef.current) audioRef.current.volume = playerVolume;
								}
							}}
							title="مؤقت السكون (٣٠ دقيقة / نهاية السورة / إيقاف)"
						>
							<Moon size={12} />
							<span>
								{sleepMode === "off"
									? "السكون"
									: sleepMode === "end-of-surah"
										? "نهاية السورة"
										: `${Math.ceil(sleepRemainingSec / 60)} د`}
							</span>
						</button>

						<div className="m-vol-wrap">
							<button
								className="m-icon-btn"
								onClick={() => {
									const next = playerVolume > 0 ? 0 : 0.9;
									setPlayerVolume(next);
									localStorage.setItem("mathani-player-volume", String(next));
									if (audioRef.current) audioRef.current.volume = next;
								}}
								title="مستوى صوت المشغل"
							>
								<SpeakerIcon size={17} muted={playerVolume === 0} />
							</button>
							<input
								type="range"
								className="m-vol-slider"
								min={0}
								max={1}
								step={0.02}
								value={playerVolume}
								onChange={(e) => {
									const v = parseFloat(e.target.value);
									setPlayerVolume(v);
									localStorage.setItem("mathani-player-volume", String(v));
									if (audioRef.current) audioRef.current.volume = v;
								}}
							/>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
