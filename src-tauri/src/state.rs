use crate::types::{IntRect, MediaInfo, SystemCommand};
use std::collections::HashMap;
use std::sync::mpsc::Sender;
use std::sync::{
    atomic::{AtomicBool, AtomicI32, AtomicI64, AtomicU32},
    Mutex, OnceLock,
};
use tauri::{AppHandle, PhysicalPosition, PhysicalSize};

pub static COMMAND_SENDER: OnceLock<Sender<SystemCommand>> = OnceLock::new();
pub static MAIN_APPBAR_REGISTERED: AtomicBool = AtomicBool::new(false);
pub static CURRENT_NOTCH_OVERLAP: AtomicI32 = AtomicI32::new(-1);

/// Set first on every quit/restart path. While windows and webviews are torn
/// down, Tauri's window table is mutably borrowed; a window call arriving then
/// (from the mouse hook or a background loop) panics with "RefCell already
/// mutably borrowed", so those callers stand down once this is set.
pub static SHUTTING_DOWN: AtomicBool = AtomicBool::new(false);

pub static NOTCH_RECT: Mutex<Option<IntRect>> = Mutex::new(None);
pub static NOTCH_IS_HOVERED: AtomicBool = AtomicBool::new(false);
/// Frontend-reported whether the notch is actually on screen. While false in
/// smart/peek mode the notch must stay click-through even over its footprint.
pub static NOTCH_IS_VISIBLE: AtomicBool = AtomicBool::new(true);

pub static BRIGHTNESS_SENDER: OnceLock<Sender<u32>> = OnceLock::new();
pub static CURRENT_BRIGHTNESS: AtomicU32 = AtomicU32::new(50);
pub static CURRENT_VOLUME: AtomicU32 = AtomicU32::new(50);
pub static LAST_BRIGHTNESS_CHANGE: AtomicI64 = AtomicI64::new(0);
pub static ANY_MEDIA_PLAYING: AtomicBool = AtomicBool::new(false);
pub static CURRENT_FOREGROUND_FULLSCREEN: AtomicBool = AtomicBool::new(false);

/// Active local Quran playback state pushed by the Mathani player window.
/// While `Some(info)` with `info.has_media == true`, the Dynamic Island
/// displays Mathani's live Surah/Reciter/Seek state directly and routes
/// Play/Pause/Next/Prev/Seek commands straight back to `PlayerApp.tsx`.
pub static MATHANI_MEDIA: Mutex<Option<MediaInfo>> = Mutex::new(None);

pub static SINGLE_INSTANCE_MUTEX_HANDLE: OnceLock<isize> = OnceLock::new();
pub static SINGLE_INSTANCE_EVENT_HANDLE: OnceLock<isize> = OnceLock::new();

pub fn close_single_instance_handles() {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::Foundation::HANDLE;
    if let Some(&h) = SINGLE_INSTANCE_MUTEX_HANDLE.get() {
        if h != 0 {
            unsafe {
                let _ = CloseHandle(HANDLE(h as *mut _));
            }
        }
    }
    if let Some(&h) = SINGLE_INSTANCE_EVENT_HANDLE.get() {
        if h != 0 {
            unsafe {
                let _ = CloseHandle(HANDLE(h as *mut _));
            }
        }
    }
}

pub static MAIN_WINDOW_RECT: Mutex<Option<(PhysicalPosition<i32>, PhysicalSize<u32>)>> =
    Mutex::new(None);

pub static DISPLAY_MONITOR_HANDLE: OnceLock<AppHandle> = OnceLock::new();
pub static LAST_DISPLAY_CHANGE_MS: AtomicI64 = AtomicI64::new(0);

/// Bounds (x, y, width, height) of the expanded per-app volume mixer panel in
/// overlay CSS pixels. `None` while the mixer is collapsed.
pub static VOLUME_MIXER_RECT: Mutex<Option<(f64, f64, f64, f64)>> = Mutex::new(None);

pub static SETTINGS_CACHE: OnceLock<Mutex<HashMap<String, serde_json::Value>>> = OnceLock::new();
/// Serialize read/modify/write settings commands across all webviews.
pub static SETTINGS_FILE_LOCK: Mutex<()> = Mutex::new(());
