use std::collections::HashMap;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, Manager, Window};

use crate::services::unregister_appbar_native;
use crate::state::*;
use crate::types::{
    BrightnessChangeEvent, IntRect, MediaInfo, VolumeChangeEvent, WifiStatus,
};
use crate::utils::*;

#[tauri::command]
pub async fn set_notch_hovered(app: AppHandle, hovered: bool) {
    NOTCH_IS_HOVERED.store(hovered, Ordering::Relaxed);
    crate::services::refresh_main_interaction(&app);
}

#[tauri::command]
pub async fn set_notch_visible(visible: bool) {
    NOTCH_IS_VISIBLE.store(visible, Ordering::Relaxed);
}

#[tauri::command]
pub fn setup_shelf_drop(app: AppHandle) {
    let first = app.clone();
    let _ = app.run_on_main_thread(move || crate::shelf::setup(&first));
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;
        let late = app.clone();
        let _ = app.run_on_main_thread(move || crate::shelf::setup(&late));
    });
}

#[tauri::command]
pub async fn shelf_thumbnail(path: String) -> crate::shelf_preview::ShelfPreview {
    tauri::async_runtime::spawn_blocking(move || crate::shelf_preview::preview(&path))
        .await
        .unwrap_or(crate::shelf_preview::ShelfPreview {
            thumb: None,
            text: None,
            folder: false,
        })
}

#[tauri::command]
pub async fn shelf_open(path: String) -> Result<(), String> {
    tauri_plugin_opener::open_path(&path, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn shelf_prune(paths: Vec<String>) -> Vec<String> {
    paths
        .into_iter()
        .filter(|p| std::path::Path::new(p).exists())
        .collect()
}

#[tauri::command]
pub fn shelf_drag_icon() -> Option<String> {
    use base64::Engine;

    let page = image::Rgba([246, 246, 246, 255]);
    let fold = image::Rgba([198, 198, 198, 255]);
    let line = image::Rgba([152, 152, 152, 255]);
    let mut img = image::RgbaImage::from_pixel(64, 64, image::Rgba([0, 0, 0, 0]));

    for y in 6..58u32 {
        for x in 14..50u32 {
            let in_fold = x >= 38 && y <= 18 && (x - 38) + (y - 6) >= 12;
            img.put_pixel(x, y, if in_fold { fold } else { page });
        }
    }
    for (i, y) in [22u32, 30, 38, 46].into_iter().enumerate() {
        let end = if i == 3 { 36 } else { 42 };
        for x in 20..end {
            img.put_pixel(x, y, line);
        }
    }

    let mut png_bytes: Vec<u8> = Vec::new();
    img.write_to(
        &mut std::io::Cursor::new(&mut png_bytes),
        image::ImageFormat::Png,
    )
    .ok()?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
    Some(format!("data:image/png;base64,{}", b64))
}

#[tauri::command]
pub async fn update_notch_rect(rect: IntRect) {
    if let Ok(mut r) = NOTCH_RECT.lock() {
        *r = Some(rect);
    }
}

#[tauri::command]
pub fn resize_settings_window(app: AppHandle, width: f64, height: f64) {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.set_size(tauri::LogicalSize::new(width, height));
    }
}

#[tauri::command]
pub async fn sync_appbar(app: AppHandle) {
    crate::services::reconcile_main_appbar(&app);
}

#[tauri::command]
pub async fn change_notch_mode(app: AppHandle, mode: String) {
    if let Some(main_win) = app.get_webview_window("main") {
        if mode == "fixed" {
            crate::services::apply_main_appbar_mode(&app, true);
        } else {
            let _ = main_win.show();
            crate::services::apply_main_appbar_mode(&app, false);

            let main_clone = main_win.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                if !MAIN_APPBAR_REGISTERED.load(Ordering::Relaxed) {
                    if let Ok(hwnd) = main_clone.hwnd() {
                        re_assert_topmost(hwnd);
                    }
                }
            });
        }
        if let Ok(Some(monitor)) = main_win.primary_monitor() {
            let m_pos = monitor.position();
            let m_size = monitor.size();
            let scale = monitor.scale_factor();
            let bloom_scale = crate::utils::get_bloom_scale(&app);
            let target_height = (420.0 * bloom_scale * scale) as u32;
            let _ = main_win.set_position(tauri::PhysicalPosition::new(m_pos.x, m_pos.y));
            let _ = main_win.set_size(tauri::PhysicalSize::new(m_size.width, target_height));
        }

        let current = CURRENT_NOTCH_OVERLAP.load(Ordering::Relaxed);
        if current != -1 {
            let _ = app.emit("notch-overlap", current == 1);
        }
    }
}

#[tauri::command]
pub async fn open_app(app: AppHandle, app_name: String) {
    if app_name == "bloom-settings" {
        open_settings_window(app);
        return;
    }
    if app_name == "mathani-player" {
        open_player_window(app);
        return;
    }
    tauri::async_runtime::spawn_blocking(move || unsafe {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

        let wide: Vec<u16> = app_name.encode_utf16().chain(std::iter::once(0)).collect();
        let _ = ShellExecuteW(
            Some(HWND(std::ptr::null_mut())),
            windows::core::w!("open"),
            windows::core::PCWSTR(wide.as_ptr()),
            windows::core::PCWSTR::null(),
            windows::core::PCWSTR::null(),
            SW_SHOWNORMAL,
        );
    });
}

#[tauri::command]
pub fn open_player_window(app: AppHandle) {
    if let Some(win) = app.get_webview_window("player") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        if let Ok(hwnd) = win.hwnd() {
            unsafe {
                use windows::Win32::UI::WindowsAndMessaging::{
                    SetForegroundWindow, ShowWindow, SW_RESTORE, SW_SHOW,
                };
                let _ = ShowWindow(hwnd, SW_SHOW);
                let _ = ShowWindow(hwnd, SW_RESTORE);
                let _ = SetForegroundWindow(hwnd);
            }
        }
    }
}

#[tauri::command]
pub fn open_settings_window(app: AppHandle) {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        if let Ok(hwnd) = win.hwnd() {
            unsafe {
                use windows::Win32::UI::WindowsAndMessaging::{
                    SetForegroundWindow, ShowWindow, SW_RESTORE, SW_SHOW,
                };
                let _ = ShowWindow(hwnd, SW_SHOW);
                let _ = ShowWindow(hwnd, SW_RESTORE);
                let _ = SetForegroundWindow(hwnd);
            }
        }
    }
}

#[tauri::command]
pub fn get_update_state() -> serde_json::Value {
    serde_json::json!({
        "available": false,
        "version": null,
        "notes": null
    })
}

#[tauri::command]
pub fn open_wifi_settings() {
    unsafe {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::Shell::ShellExecuteA;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        let _ = ShellExecuteA(
            Some(HWND(std::ptr::null_mut())),
            windows::core::PCSTR(c"open".as_ptr() as *const u8),
            windows::core::PCSTR(c"ms-availablenetworks:".as_ptr() as *const u8),
            windows::core::PCSTR::null(),
            windows::core::PCSTR::null(),
            SW_SHOWNORMAL,
        );
    }
}

#[tauri::command]
pub fn open_sound_settings() {
    unsafe {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::Shell::ShellExecuteA;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        let _ = ShellExecuteA(
            Some(HWND(std::ptr::null_mut())),
            windows::core::PCSTR(c"open".as_ptr() as *const u8),
            windows::core::PCSTR(c"ms-settings:sound".as_ptr() as *const u8),
            windows::core::PCSTR::null(),
            windows::core::PCSTR::null(),
            SW_SHOWNORMAL,
        );
    }
}

#[tauri::command]
pub fn open_notification_center() {
    unsafe {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::Shell::ShellExecuteA;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        let _ = ShellExecuteA(
            Some(HWND(std::ptr::null_mut())),
            windows::core::PCSTR(c"open".as_ptr() as *const u8),
            windows::core::PCSTR(c"ms-actioncenter:".as_ptr() as *const u8),
            windows::core::PCSTR::null(),
            windows::core::PCSTR::null(),
            SW_SHOWNORMAL,
        );
    }
}

/// Native Windows taskbar remains 100% untouched in Mathani; focus the Windows
/// notification area cleanly via Win+B without modifying Shell_TrayWnd.
#[tauri::command]
pub fn open_system_tray() {
    unsafe {
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_B, VK_LWIN,
        };
        let inputs = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_LWIN,
                        wScan: 0,
                        dwFlags: Default::default(),
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_B,
                        wScan: 0,
                        dwFlags: Default::default(),
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_B,
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VK_LWIN,
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        ];
        let _ = SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
    }
}

#[tauri::command]
pub fn sync_mathani_media(app: AppHandle, info: MediaInfo) {
    let has = info.has_media;
    let playing = info.is_playing;
    if let Ok(mut guard) = MATHANI_MEDIA.lock() {
        *guard = if has { Some(info.clone()) } else { None };
    }
    ANY_MEDIA_PLAYING.store(has && playing, Ordering::Relaxed);
    let _ = app.emit("media-update", info);
}

fn mathani_has_active_media() -> bool {
    MATHANI_MEDIA
        .lock()
        .ok()
        .and_then(|g| g.as_ref().map(|m| m.has_media))
        .unwrap_or(false)
}

#[tauri::command]
pub fn media_play_pause(app: AppHandle) {
    if mathani_has_active_media() {
        let _ = app.emit(
            "mathani-player-cmd",
            serde_json::json!({ "action": "play-pause" }),
        );
        return;
    }
    if let Some(sender) = COMMAND_SENDER.get() {
        let _ = sender.send(crate::types::SystemCommand::MediaPlayPause);
    }
}

#[tauri::command]
pub fn media_next(app: AppHandle) {
    if mathani_has_active_media() {
        let _ = app.emit(
            "mathani-player-cmd",
            serde_json::json!({ "action": "next" }),
        );
        return;
    }
    if let Some(sender) = COMMAND_SENDER.get() {
        let _ = sender.send(crate::types::SystemCommand::MediaNext);
    }
}

#[tauri::command]
pub fn media_previous(app: AppHandle) {
    if mathani_has_active_media() {
        let _ = app.emit(
            "mathani-player-cmd",
            serde_json::json!({ "action": "previous" }),
        );
        return;
    }
    if let Some(sender) = COMMAND_SENDER.get() {
        let _ = sender.send(crate::types::SystemCommand::MediaPrevious);
    }
}

#[tauri::command]
pub fn media_seek(app: AppHandle, position_ms: f64) {
    if mathani_has_active_media() {
        let _ = app.emit(
            "mathani-player-cmd",
            serde_json::json!({
                "action": "seek",
                "position_ms": position_ms as i64
            }),
        );
        return;
    }
    if let Some(sender) = COMMAND_SENDER.get() {
        let _ = sender.send(crate::types::SystemCommand::MediaSeek(position_ms as i64));
    }
}

#[tauri::command]
pub fn set_volume(volume: f32) {
    if let Some(sender) = COMMAND_SENDER.get() {
        let _ = sender.send(crate::types::SystemCommand::SetVolume(volume));
    }
}

#[tauri::command]
pub fn set_volume_mixer_rect(x: f64, y: f64, width: f64, height: f64) {
    if let Ok(mut rect) = VOLUME_MIXER_RECT.lock() {
        *rect = Some((x, y, width, height));
    }
}

#[tauri::command]
pub fn clear_volume_mixer_rect() {
    if let Ok(mut rect) = VOLUME_MIXER_RECT.lock() {
        *rect = None;
    }
}

/// Unregisters the top Notch AppBar (if fixed mode was active) so Windows gives work area back.
pub fn release_appbars(handle: &AppHandle) {
    if let Some(w) = handle.get_webview_window("main") {
        if let Ok(hwnd) = w.hwnd() {
            unregister_appbar_native(hwnd);
        }
    }
    MAIN_APPBAR_REGISTERED.store(false, Ordering::Relaxed);
}

pub fn shutdown_and_exit(handle: &AppHandle) {
    crate::diagnostics::record("shutdown", "releasing Notch AppBar and exiting Mathani");
    SHUTTING_DOWN.store(true, Ordering::Relaxed);
    release_appbars(handle);
    for (_, w) in handle.webview_windows() {
        let _ = w.destroy();
    }
    handle.exit(0);
}

#[tauri::command]
pub async fn quit_bloom(handle: AppHandle) {
    shutdown_and_exit(&handle);
}

#[tauri::command]
pub async fn restart_bloom(handle: AppHandle) {
    crate::diagnostics::record("restart", "releasing Notch AppBar and restarting Mathani");
    SHUTTING_DOWN.store(true, Ordering::Relaxed);
    release_appbars(&handle);
    if let Some(w) = handle.get_webview_window("settings") {
        let _ = w.destroy();
    }
    if let Some(w) = handle.get_webview_window("player") {
        let _ = w.destroy();
    }
    close_single_instance_handles();
    handle.restart();
}

#[tauri::command(async)]
pub fn save_setting(app: AppHandle, key: String, value: serde_json::Value) -> Result<(), String> {
    static SAVE_COMMAND_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
    let _save_guard = SAVE_COMMAND_LOCK.lock().map_err(|e| e.to_string())?;
    let path = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("settings.json");
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let settings = crate::utils::save_setting_file(&path, key.clone(), value).map_err(|error| {
        crate::diagnostics::record("settings_save_failed", &format!("key={key} error={error}"));
        error
    })?;

    let _ = app.emit(
        "settings-changed",
        serde_json::json!({ "key": &key, "value": &settings[&key] }),
    );

    if key == "bloom-scale" {
        crate::services::reconcile_main_appbar(&app);
    }
    Ok(())
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<HashMap<String, serde_json::Value>, String> {
    let path = match app.path().app_config_dir() {
        Ok(p) => p.join("settings.json"),
        Err(_) => return Ok(HashMap::new()),
    };
    crate::utils::read_settings_file(&path)
}

#[tauri::command]
pub fn settings_file_readable(app: AppHandle) -> bool {
    app.path().app_config_dir().ok().is_some_and(|dir| {
        let path = dir.join("settings.json");
        path.exists() && crate::utils::read_settings_file(&path).is_ok()
    })
}

fn get_radio_state_sync(kind: windows::Devices::Radios::RadioKind) -> Result<bool, String> {
    use windows::Devices::Radios::{Radio, RadioState};
    unsafe {
        let _ = windows::Win32::System::Com::CoInitializeEx(
            None,
            windows::Win32::System::Com::COINIT_MULTITHREADED,
        );
    }
    let radios = Radio::GetRadiosAsync()
        .and_then(|op| op.get())
        .map_err(|e| e.to_string())?;
    for i in 0..radios.Size().unwrap_or(0) {
        if let Ok(radio) = radios.GetAt(i) {
            if radio.Kind().ok() == Some(kind) {
                return Ok(radio.State().ok() == Some(RadioState::On));
            }
        }
    }
    Ok(false)
}

fn set_radio_state_sync(
    kind: windows::Devices::Radios::RadioKind,
    enabled: bool,
) -> Result<(), String> {
    use windows::Devices::Radios::{Radio, RadioState};
    unsafe {
        let _ = windows::Win32::System::Com::CoInitializeEx(
            None,
            windows::Win32::System::Com::COINIT_MULTITHREADED,
        );
    }
    let radios = Radio::GetRadiosAsync()
        .and_then(|op| op.get())
        .map_err(|e| e.to_string())?;
    for i in 0..radios.Size().unwrap_or(0) {
        if let Ok(radio) = radios.GetAt(i) {
            if radio.Kind().ok() == Some(kind) {
                let target = if enabled {
                    RadioState::On
                } else {
                    RadioState::Off
                };
                let _ = radio.SetStateAsync(target).and_then(|op| op.get());
                return Ok(());
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_volume() -> f32 {
    crate::state::CURRENT_VOLUME.load(std::sync::atomic::Ordering::Relaxed) as f32 / 100.0
}

#[tauri::command]
pub async fn get_volume_state() -> Result<VolumeChangeEvent, String> {
    tauri::async_runtime::spawn_blocking(|| unsafe {
        use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
        use windows::Win32::Media::Audio::{eConsole, eRender, IMMDeviceEnumerator};
        use windows::Win32::System::Com::{
            CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
        };

        let com_initialized = CoInitializeEx(None, COINIT_MULTITHREADED).is_ok();
        let result = (|| -> Result<VolumeChangeEvent, String> {
            let enumerator: IMMDeviceEnumerator = CoCreateInstance(
                &windows::Win32::Media::Audio::MMDeviceEnumerator,
                None,
                CLSCTX_ALL,
            )
            .map_err(|e| e.to_string())?;
            let device = enumerator
                .GetDefaultAudioEndpoint(eRender, eConsole)
                .map_err(|e| e.to_string())?;
            let endpoint: IAudioEndpointVolume = device
                .Activate(CLSCTX_ALL, None)
                .map_err(|e| e.to_string())?;
            let volume = endpoint
                .GetMasterVolumeLevelScalar()
                .map_err(|e| e.to_string())?;
            let is_muted = endpoint.GetMute().map(|m| m.as_bool()).unwrap_or(false);
            CURRENT_VOLUME.store((volume * 100.0) as u32, Ordering::Relaxed);
            Ok(VolumeChangeEvent { volume, is_muted })
        })();
        if com_initialized {
            CoUninitialize();
        }
        result
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn get_brightness() -> u32 {
    crate::state::CURRENT_BRIGHTNESS.load(std::sync::atomic::Ordering::Relaxed)
}

#[tauri::command]
pub async fn get_wifi_status() -> Result<WifiStatus, String> {
    tauri::async_runtime::spawn_blocking(|| -> Result<WifiStatus, String> {
        let enabled = get_radio_state_sync(windows::Devices::Radios::RadioKind::WiFi)?;
        let ssid = if enabled {
            crate::wifi::connected_ssid()
        } else {
            None
        };
        Ok(WifiStatus {
            enabled,
            connected: ssid.is_some(),
            ssid,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn set_wifi_state(enabled: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        set_radio_state_sync(windows::Devices::Radios::RadioKind::WiFi, enabled)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_bluetooth_state() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(|| {
        get_radio_state_sync(windows::Devices::Radios::RadioKind::Bluetooth)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn set_bluetooth_state(enabled: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        set_radio_state_sync(windows::Devices::Radios::RadioKind::Bluetooth, enabled)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn open_bluetooth_settings() {
    unsafe {
        use windows::Win32::UI::Shell::ShellExecuteA;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        let _ = ShellExecuteA(
            None,
            windows::core::PCSTR(c"open".as_ptr() as *const u8),
            windows::core::PCSTR(c"ms-settings:bluetooth".as_ptr() as *const u8),
            windows::core::PCSTR::null(),
            windows::core::PCSTR::null(),
            SW_SHOWNORMAL,
        );
    }
}

#[tauri::command]
pub fn set_brightness(app: AppHandle, brightness: u32) {
    let val = brightness.min(100);
    crate::state::CURRENT_BRIGHTNESS.store(val, Ordering::Relaxed);
    crate::state::LAST_BRIGHTNESS_CHANGE.store(crate::utils::get_now_ms(), Ordering::Relaxed);
    let _ = app.emit(
        "brightness-change",
        BrightnessChangeEvent { brightness: val },
    );
    if let Some(tx) = crate::state::BRIGHTNESS_SENDER.get() {
        let _ = tx.send(val);
    }
}

#[tauri::command]
pub async fn get_battery_saver_state() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(|| {
        unsafe {
            let _ = windows::Win32::System::Com::CoInitializeEx(
                None,
                windows::Win32::System::Com::COINIT_MULTITHREADED,
            );
        }
        use windows::System::Power::{EnergySaverStatus, PowerManager};
        match PowerManager::EnergySaverStatus() {
            Ok(status) => Ok(status == EnergySaverStatus::On),
            Err(_) => Ok(false),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn open_battery_saver_settings() {
    unsafe {
        use windows::Win32::UI::Shell::ShellExecuteA;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        let _ = ShellExecuteA(
            None,
            windows::core::PCSTR(c"open".as_ptr() as *const u8),
            windows::core::PCSTR(c"ms-settings:batterysaver".as_ptr() as *const u8),
            windows::core::PCSTR::null(),
            windows::core::PCSTR::null(),
            SW_SHOWNORMAL,
        );
    }
}

#[tauri::command]
pub fn get_cpu_usage() -> Result<u32, String> {
    use std::sync::atomic::{AtomicU64, Ordering};
    static LAST_IDLE: AtomicU64 = AtomicU64::new(0);
    static LAST_KERNEL: AtomicU64 = AtomicU64::new(0);
    static LAST_USER: AtomicU64 = AtomicU64::new(0);

    unsafe {
        let mut idle = windows::Win32::Foundation::FILETIME::default();
        let mut kernel = windows::Win32::Foundation::FILETIME::default();
        let mut user = windows::Win32::Foundation::FILETIME::default();
        windows::Win32::System::Threading::GetSystemTimes(
            Some(&mut idle),
            Some(&mut kernel),
            Some(&mut user),
        )
        .map_err(|e| format!("GetSystemTimes failed: {e}"))?;

        let idle_u64 = (idle.dwHighDateTime as u64) << 32 | idle.dwLowDateTime as u64;
        let kernel_u64 = (kernel.dwHighDateTime as u64) << 32 | kernel.dwLowDateTime as u64;
        let user_u64 = (user.dwHighDateTime as u64) << 32 | user.dwLowDateTime as u64;

        let prev_idle = LAST_IDLE.swap(idle_u64, Ordering::Relaxed);
        let prev_kernel = LAST_KERNEL.swap(kernel_u64, Ordering::Relaxed);
        let prev_user = LAST_USER.swap(user_u64, Ordering::Relaxed);

        let idle_delta = idle_u64.saturating_sub(prev_idle);
        let kernel_delta = kernel_u64.saturating_sub(prev_kernel);
        let user_delta = user_u64.saturating_sub(prev_user);
        let total = kernel_delta + user_delta;

        if total == 0 {
            return Ok(0);
        }
        let usage = ((total - idle_delta) * 100) / total;
        Ok(usage as u32)
    }
}

#[tauri::command]
pub fn get_ram_usage() -> Result<f32, String> {
    unsafe {
        let mut mem = windows::Win32::System::SystemInformation::MEMORYSTATUSEX::default();
        mem.dwLength =
            std::mem::size_of::<windows::Win32::System::SystemInformation::MEMORYSTATUSEX>() as u32;
        windows::Win32::System::SystemInformation::GlobalMemoryStatusEx(&mut mem)
            .map_err(|e| format!("GlobalMemoryStatusEx failed: {e}"))?;
        Ok(mem.dwMemoryLoad as f32)
    }
}

#[tauri::command]
pub fn get_disk_space() -> Result<u64, String> {
    unsafe {
        let mut free_bytes = 0u64;
        let mut total_bytes = 0u64;
        let mut total_free = 0u64;
        windows::Win32::Storage::FileSystem::GetDiskFreeSpaceExW(
            windows::core::w!("C:\\"),
            Some(&mut free_bytes),
            Some(&mut total_bytes),
            Some(&mut total_free),
        )
        .map_err(|e| format!("GetDiskFreeSpaceEx failed: {e}"))?;
        Ok(free_bytes / (1024 * 1024 * 1024))
    }
}

#[tauri::command]
pub fn get_network_speed() -> Result<(u64, u64), String> {
    use std::sync::{Mutex, OnceLock};
    use std::time::Instant;
    static LAST_SAMPLE: OnceLock<Mutex<Option<(Instant, u64, u64)>>> = OnceLock::new();

    let (mut total_in, mut total_out) = (0u64, 0u64);
    unsafe {
        let mut out = std::mem::MaybeUninit::<
            *mut windows::Win32::NetworkManagement::IpHelper::MIB_IF_TABLE2,
        >::uninit();
        let ret = windows::Win32::NetworkManagement::IpHelper::GetIfTable2(out.as_mut_ptr());
        if !ret.is_ok() {
            return Err(format!("GetIfTable2 failed: {ret:?}"));
        }
        let Some(table) = std::ptr::NonNull::new(out.assume_init()) else {
            return Err("GetIfTable2 returned no table".to_string());
        };
        let table_ptr = table.as_ptr();
        let rows = std::slice::from_raw_parts(
            std::ptr::addr_of!((*table_ptr).Table)
                .cast::<windows::Win32::NetworkManagement::IpHelper::MIB_IF_ROW2>(),
            table.as_ref().NumEntries as usize,
        );
        for row in rows {
            total_in = total_in.saturating_add(row.InOctets);
            total_out = total_out.saturating_add(row.OutOctets);
        }
        windows::Win32::NetworkManagement::IpHelper::FreeMibTable(table_ptr as *const _);
    }

    let now = Instant::now();
    let mut last = LAST_SAMPLE
        .get_or_init(|| Mutex::new(None))
        .lock()
        .map_err(|e| e.to_string())?;
    let speed = if let Some((previous, sent, recv)) = *last {
        let elapsed_ms = now.duration_since(previous).as_millis().max(1);
        let rate = |current: u64, previous: u64| {
            ((current.saturating_sub(previous) as u128 * 1000) / elapsed_ms).min(u64::MAX as u128)
                as u64
        };
        (rate(total_out, sent), rate(total_in, recv))
    } else {
        (0, 0)
    };
    *last = Some((now, total_out, total_in));
    Ok(speed)
}

#[tauri::command]
pub fn get_windows_accent_color() -> Option<String> {
    unsafe {
        use windows::Win32::System::Registry::{
            RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY_CURRENT_USER, KEY_READ, REG_BINARY,
            REG_DWORD,
        };

        let subkey =
            windows::core::w!("Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent");
        let mut hkey = windows::Win32::System::Registry::HKEY::default();
        if RegOpenKeyExW(HKEY_CURRENT_USER, subkey, Some(0), KEY_READ, &mut hkey).is_ok() {
            let mut value_type = REG_BINARY;
            let mut palette = [0u8; 32];
            let mut value_size = 32u32;
            let val_name = windows::core::w!("AccentPalette");
            if RegQueryValueExW(
                hkey,
                val_name,
                None,
                Some(&mut value_type),
                Some(palette.as_mut_ptr()),
                Some(&mut value_size),
            )
            .is_ok()
            {
                let _ = RegCloseKey(hkey);
                if value_size >= 15 {
                    let r = palette[12];
                    let g = palette[13];
                    let b = palette[14];
                    return Some(format!("#{:02x}{:02x}{:02x}", r, g, b));
                }
            } else {
                let _ = RegCloseKey(hkey);
            }
        }

        let subkey = windows::core::w!("Software\\Microsoft\\Windows\\DWM");
        let mut hkey = windows::Win32::System::Registry::HKEY::default();
        if RegOpenKeyExW(HKEY_CURRENT_USER, subkey, Some(0), KEY_READ, &mut hkey).is_ok() {
            let mut value_type = REG_DWORD;
            let mut color_val = 0u32;
            let mut value_size = std::mem::size_of::<u32>() as u32;
            let val_name = windows::core::w!("AccentColor");
            if RegQueryValueExW(
                hkey,
                val_name,
                None,
                Some(&mut value_type),
                Some(&mut color_val as *mut u32 as *mut u8),
                Some(&mut value_size),
            )
            .is_ok()
            {
                let _ = RegCloseKey(hkey);
                let r = (color_val & 0xff) as u8;
                let g = ((color_val >> 8) & 0xff) as u8;
                let b = ((color_val >> 16) & 0xff) as u8;
                return Some(format!("#{:02x}{:02x}{:02x}", r, g, b));
            }
            let _ = RegCloseKey(hkey);
        }
    }
    None
}

#[tauri::command]
pub fn get_system_accent_color() -> Result<String, String> {
    if let Some(color) = get_windows_accent_color() {
        return Ok(color);
    }

    unsafe {
        let mut color = 0u32;
        let mut opaque = windows::core::BOOL(0);
        if windows::Win32::Graphics::Dwm::DwmGetColorizationColor(&mut color, &mut opaque).is_ok() {
            let r = ((color >> 16) & 0xff) as u8;
            let g = ((color >> 8) & 0xff) as u8;
            let b = (color & 0xff) as u8;
            let hex = format!("#{:02x}{:02x}{:02x}", r, g, b);
            Ok(hex)
        } else {
            Err("Failed to query colorization color".into())
        }
    }
}

#[tauri::command]
pub async fn export_settings_to_file(
    app: AppHandle,
    window: Window,
) -> Result<Option<String>, String> {
    if window.label() != "settings" && window.label() != "player" {
        return Err("Settings export is only available from Settings or Mathani Player".into());
    }
    let source = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("settings.json");
    if !source.exists() {
        return Err("لا يوجد ملف إعدادات محفوظ بعد".into());
    }
    let content = std::fs::read_to_string(&source).map_err(|e| e.to_string())?;
    crate::utils::read_settings_file(&source)?;

    let picked = tauri::async_runtime::spawn_blocking(move || {
        use tauri_plugin_dialog::DialogExt;
        app.dialog()
            .file()
            .set_parent(&window)
            .set_title("تصدير إعدادات مثاني")
            .set_file_name("mathani-settings.json")
            .add_filter("JSON", &["json"])
            .blocking_save_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    let Some(file_path) = picked else {
        return Ok(None);
    };
    let path = file_path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

const MAX_SETTINGS_IMPORT_BYTES: u64 = 1024 * 1024;

fn read_settings_import(reader: impl std::io::Read) -> Result<String, String> {
    use std::io::Read;

    let mut bytes = Vec::new();
    reader
        .take(MAX_SETTINGS_IMPORT_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    if bytes.len() as u64 > MAX_SETTINGS_IMPORT_BYTES {
        return Err("Settings file exceeds the 1 MiB import limit".into());
    }
    String::from_utf8(bytes).map_err(|e| format!("Settings file is not valid UTF-8: {}", e))
}

fn apply_imported_settings(app: &AppHandle, settings: &str) -> Result<(), String> {
    let imported: HashMap<String, serde_json::Value> =
        serde_json::from_str(settings.trim_start_matches('\u{feff}'))
            .map_err(|e| format!("Invalid JSON: {}", e))?;

    let path = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("settings.json");
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let _guard = SETTINGS_FILE_LOCK.lock().map_err(|e| e.to_string())?;
    let previous = crate::utils::read_settings_file(&path)?;
    crate::utils::write_settings_file(&path, &imported)?;
    crate::utils::replace_settings_cache(imported.clone());
    drop(_guard);

    for (key, value) in &imported {
        let _ = app.emit(
            "settings-changed",
            serde_json::json!({ "key": key, "value": value }),
        );
    }

    let keep = ["bloom-first-run", "bloom-app-version"];
    for key in previous.keys().filter(|key| {
        key.starts_with("bloom-") && !keep.contains(&key.as_str()) && !imported.contains_key(*key)
    }) {
        let _ = app.emit(
            "settings-external-changed",
            serde_json::json!({ "key": key, "value": null }),
        );
    }

    if imported.get("bloom-scale").is_some() {
        crate::services::reconcile_main_appbar(app);
    }

    Ok(())
}

#[tauri::command]
pub async fn import_settings_from_file(
    app: AppHandle,
    window: Window,
) -> Result<Option<String>, String> {
    if window.label() != "settings" && window.label() != "player" {
        return Err("Settings import is only available from Settings or Mathani Player".into());
    }
    let picked = tauri::async_runtime::spawn_blocking({
        let app = app.clone();
        move || {
            use tauri_plugin_dialog::DialogExt;
            app.dialog()
                .file()
                .set_parent(&window)
                .set_title("استيراد إعدادات مثاني")
                .add_filter("JSON", &["json"])
                .blocking_pick_file()
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    let Some(file_path) = picked else {
        return Ok(None);
    };
    let path = file_path.into_path().map_err(|e| e.to_string())?;
    let file = std::fs::File::open(&path).map_err(|e| format!("Failed to open file: {}", e))?;
    let size = file
        .metadata()
        .map_err(|e| format!("Failed to inspect file: {}", e))?
        .len();
    if size > MAX_SETTINGS_IMPORT_BYTES {
        return Err("Settings file exceeds the 1 MiB import limit".into());
    }
    let content = read_settings_import(file)?;
    apply_imported_settings(&app, &content)?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn reset_settings(app: AppHandle) -> Result<(), String> {
    let path = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("settings.json");
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let keep = ["bloom-first-run", "bloom-app-version"];
    let _guard = SETTINGS_FILE_LOCK.lock().map_err(|e| e.to_string())?;
    let mut settings = crate::utils::read_settings_file(&path)?;
    let removed: Vec<String> = settings
        .keys()
        .filter(|key| key.starts_with("bloom-") && !keep.contains(&key.as_str()))
        .cloned()
        .collect();
    for key in &removed {
        settings.remove(key);
    }

    crate::utils::write_settings_file(&path, &settings)?;
    crate::utils::replace_settings_cache(settings);
    drop(_guard);

    for key in removed {
        let _ = app.emit(
            "settings-external-changed",
            serde_json::json!({ "key": key, "value": null }),
        );
    }
    Ok(())
}

pub fn setup_settings_watcher(app: AppHandle) {
    let config_dir = match app.path().app_config_dir() {
        Ok(p) => p,
        Err(_) => return,
    };
    let settings_path = config_dir.join("settings.json");

    let _ = crate::state::SETTINGS_CACHE.set(std::sync::Mutex::new(HashMap::new()));

    std::thread::spawn(move || {
        use windows::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
        use windows::Win32::Storage::FileSystem::{
            CreateFileW, ReadDirectoryChangesW, FILE_FLAG_BACKUP_SEMANTICS, FILE_LIST_DIRECTORY,
            FILE_NOTIFY_CHANGE_FILE_NAME, FILE_NOTIFY_CHANGE_LAST_WRITE, OPEN_EXISTING,
        };

        unsafe {
            let dir_path: Vec<u16> = config_dir
                .to_string_lossy()
                .encode_utf16()
                .chain(std::iter::once(0))
                .collect();

            let dir_handle = match CreateFileW(
                windows::core::PCWSTR(dir_path.as_ptr()),
                FILE_LIST_DIRECTORY.0,
                windows::Win32::Storage::FileSystem::FILE_SHARE_READ
                    | windows::Win32::Storage::FileSystem::FILE_SHARE_WRITE
                    | windows::Win32::Storage::FileSystem::FILE_SHARE_DELETE,
                None,
                OPEN_EXISTING,
                FILE_FLAG_BACKUP_SEMANTICS,
                None,
            ) {
                Ok(h) if h != INVALID_HANDLE_VALUE => h,
                _ => return,
            };

            let mut notify_buffer = [0u32; 1024];
            let mut bytes_returned = 0u32;

            loop {
                let success = ReadDirectoryChangesW(
                    dir_handle,
                    notify_buffer.as_mut_ptr() as *mut _,
                    std::mem::size_of_val(&notify_buffer) as u32,
                    false,
                    FILE_NOTIFY_CHANGE_LAST_WRITE | FILE_NOTIFY_CHANGE_FILE_NAME,
                    Some(&mut bytes_returned),
                    None,
                    None,
                );

                if success.is_err() {
                    break;
                }

                std::thread::sleep(std::time::Duration::from_millis(200));

                let changes = {
                    let Ok(_file_guard) = SETTINGS_FILE_LOCK.lock() else {
                        continue;
                    };
                    crate::utils::read_settings_file(&settings_path)
                        .ok()
                        .map(|new_settings| {
                            let mut cache = crate::state::SETTINGS_CACHE
                                .get_or_init(|| std::sync::Mutex::new(HashMap::new()))
                                .lock()
                                .unwrap();

                            let mut changed = Vec::new();
                            for (key, value) in &new_settings {
                                if cache.get(key) != Some(value) {
                                    changed.push((key.clone(), value.clone()));
                                }
                            }

                            let removed: Vec<String> = cache
                                .keys()
                                .filter(|k| !new_settings.contains_key(*k))
                                .cloned()
                                .collect();

                            *cache = new_settings.clone();
                            (changed, removed)
                        })
                };
                if let Some((changed, removed)) = changes {
                    for (key, value) in &changed {
                        let _ = app.emit(
                            "settings-external-changed",
                            serde_json::json!({ "key": key, "value": value }),
                        );
                    }
                    for key in removed {
                        let _ = app.emit(
                            "settings-external-changed",
                            serde_json::json!({ "key": key, "value": null }),
                        );
                    }
                }
            }

            let _ = CloseHandle(dir_handle);
        }
    });
}
