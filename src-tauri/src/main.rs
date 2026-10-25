#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod battery;
mod bluetooth;
mod commands;
mod diagnostics;
mod quran;
mod services;
mod shelf;
mod shelf_preview;
mod state;
mod types;
mod utils;
mod wifi;
mod window_region;

use std::sync::atomic::Ordering;
use tauri::Manager;

use crate::commands::*;
use crate::services::*;
use crate::state::*;

fn main() {
    let is_autostart = std::env::args().any(|a| a == "--autostart");

    // Allow Dynamic Island IPC commands to start <audio> playback in the Player
    // WebView even before the user has clicked inside the Player window.
    if std::env::var_os("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").is_none() {
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--autoplay-policy=no-user-gesture-required",
        );
    }

    // Single-instance enforcement: if Mathani is already running, focus the Player window.
    unsafe {
        use windows::Win32::Foundation::{CloseHandle, GetLastError};
        use windows::Win32::System::Threading::{
            CreateEventW, CreateMutexW, OpenEventW, SetEvent, SYNCHRONIZATION_ACCESS_RIGHTS,
        };

        let mutex_name: Vec<u16> = "MathaniSingleInstance_v1"
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let event_name: Vec<u16> = "MathaniOpenPlayer_v1"
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();

        let h_mutex = CreateMutexW(None, true, windows::core::PCWSTR(mutex_name.as_ptr())).ok();
        let err = GetLastError();

        if err.0 == 183 {
            if let Ok(h_event) = OpenEventW(
                SYNCHRONIZATION_ACCESS_RIGHTS(0x00100002),
                false,
                windows::core::PCWSTR(event_name.as_ptr()),
            ) {
                let _ = SetEvent(h_event);
                let _ = CloseHandle(h_event);
            }
            if let Some(h) = h_mutex {
                let _ = CloseHandle(h);
            }
            return;
        }

        if let Ok(h_event) = CreateEventW(
            None,
            false,
            false,
            windows::core::PCWSTR(event_name.as_ptr()),
        ) {
            let _ = SINGLE_INSTANCE_EVENT_HANDLE.set(h_event.0 as isize);
        }
        if let Some(h) = h_mutex {
            let _ = SINGLE_INSTANCE_MUTEX_HANDLE.set(h.0 as isize);
        }
    }

    diagnostics::initialize();
    setup_brightness_worker();

    let app = tauri::Builder::default()
        .register_asynchronous_uri_scheme_protocol("quran", |_ctx, request, responder| {
            std::thread::spawn(move || {
                let response = crate::quran::handle_quran_stream_request(request);
                responder.respond(response);
            });
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .invoke_handler(tauri::generate_handler![
            quran::scan_quran_paths,
            quran::classify_dropped_paths,
            quran::get_track_embedded_artwork,
            quran::auto_discover_quran_folders,
            open_player_window,
            open_settings_window,
            get_update_state,
            open_wifi_settings,
            open_sound_settings,
            open_notification_center,
            open_system_tray,
            resize_settings_window,
            sync_mathani_media,
            media_play_pause,
            media_next,
            media_previous,
            media_seek,
            change_notch_mode,
            sync_appbar,
            open_app,
            update_notch_rect,
            window_region::set_window_region,
            set_notch_hovered,
            set_notch_visible,
            setup_shelf_drop,
            shelf_thumbnail,
            shelf_drag_icon,
            shelf_prune,
            shelf_open,
            quit_bloom,
            restart_bloom,
            get_volume,
            get_volume_state,
            get_brightness,
            set_volume,
            set_volume_mixer_rect,
            clear_volume_mixer_rect,
            save_setting,
            load_settings,
            settings_file_readable,
            get_wifi_status,
            set_wifi_state,
            get_bluetooth_state,
            set_bluetooth_state,
            open_bluetooth_settings,
            set_brightness,
            get_battery_saver_state,
            open_battery_saver_settings,
            battery::get_battery_details,
            get_windows_accent_color,
            get_system_accent_color,
            get_cpu_usage,
            get_ram_usage,
            get_disk_space,
            get_network_speed,
            export_settings_to_file,
            import_settings_from_file,
            reset_settings,
            wifi::wifi_list_networks,
            wifi::wifi_scan,
            wifi::wifi_connect,
            wifi::wifi_disconnect,
            wifi::wifi_forget,
            wifi::wifi_open_settings,
            bluetooth::bluetooth_list_devices,
            bluetooth::bluetooth_set_connected,
            bluetooth::bluetooth_discovery,
            bluetooth::bluetooth_pair,
            bluetooth::bluetooth_pairing_respond,
            bluetooth::bluetooth_unpair
        ])
        .setup(move |app| {
            crate::utils::init_settings_cache(app.handle());

            // 1. Setup Bloom's exact Dynamic Island / Notch ("main" window)
            let window = app.get_webview_window("main").unwrap();
            let _ = window.set_ignore_cursor_events(true);

            if let Ok(Some(monitor)) = window.primary_monitor() {
                let m_pos = monitor.position();
                let m_size = monitor.size();
                let scale = monitor.scale_factor();
                let bloom_scale = crate::utils::get_bloom_scale(app.handle());
                let target_height = (420.0 * bloom_scale * scale) as u32;
                let _ = window.set_position(tauri::PhysicalPosition::new(m_pos.x, m_pos.y));
                let _ = window.set_size(tauri::PhysicalSize::new(m_size.width, target_height));
            }
            let _ = window.show();
            reconcile_main_appbar(app.handle());

            let win_clone = window.clone();
            let update_main_rect = move || {
                if let (Ok(p), Ok(s)) = (win_clone.outer_position(), win_clone.outer_size()) {
                    if let Ok(mut lock) = MAIN_WINDOW_RECT.lock() {
                        *lock = Some((p, s));
                    }
                }
            };
            update_main_rect();

            let u_main = update_main_rect.clone();
            let handle_for_events = app.handle().clone();
            window.on_window_event(move |e| match e {
                tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                    u_main();
                }
                tauri::WindowEvent::ScaleFactorChanged { .. } => {
                    let h = handle_for_events.clone();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                        reconcile_main_appbar(&h);
                    });
                }
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    shutdown_and_exit(&handle_for_events);
                }
                _ => {}
            });

            // 2. Setup Mathani Desktop Quran Player ("player" window) with Mica + hide-on-close
            if let Some(player_win) = app.get_webview_window("player") {
                #[cfg(target_os = "windows")]
                {
                    if window_vibrancy::apply_mica(&player_win, Some(true)).is_err() {
                        let _ = window_vibrancy::apply_acrylic(&player_win, Some((9, 13, 18, 225)));
                    }
                }
                let p_clone = player_win.clone();
                player_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = p_clone.hide();
                    }
                });
                if !is_autostart {
                    let _ = player_win.show();
                    let _ = player_win.set_focus();
                }
            }

            // 3. Setup standalone Settings window ("settings") with Mica + hide-on-close
            if let Some(settings_win) = app.get_webview_window("settings") {
                #[cfg(target_os = "windows")]
                {
                    if window_vibrancy::apply_mica(&settings_win, Some(true)).is_err() {
                        let _ =
                            window_vibrancy::apply_acrylic(&settings_win, Some((9, 13, 18, 225)));
                    }
                }
                let s_clone = settings_win.clone();
                settings_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = s_clone.hide();
                    }
                });
            }

            // 4. Start Bloom Notch, Mouse Hook, WASAPI FFT Audio & System Workers
            watch_webview_processes(app.handle());
            setup_mouse_hook(app.handle().clone());
            setup_display_change_monitor(app.handle().clone());
            setup_window_change_hook(app.handle().clone());
            let tx = setup_system_worker(app.handle().clone());
            let _ = COMMAND_SENDER.set(tx);
            setup_audio_visualization(app.handle().clone());
            setup_settings_watcher(app.handle().clone());
            diagnostics::record("services_ready", "Mathani Notch & Audio workers initialized");
            wifi::setup_wifi_notifications(app.handle().clone());
            bluetooth::setup_bluetooth_notifications(app.handle().clone());

            // 5. Listen for second-instance signal to open the Player window
            if let Some(&h_event) = SINGLE_INSTANCE_EVENT_HANDLE.get() {
                if h_event != 0 {
                    let app_handle = app.handle().clone();
                    std::thread::spawn(move || {
                        use windows::Win32::Foundation::{HANDLE, WAIT_OBJECT_0};
                        use windows::Win32::System::Threading::{WaitForSingleObject, INFINITE};
                        let h_event = HANDLE(h_event as *mut _);
                        loop {
                            let result = unsafe { WaitForSingleObject(h_event, INFINITE) };
                            if result == WAIT_OBJECT_0 {
                                crate::commands::open_player_window(app_handle.clone());
                            }
                        }
                    });
                }
            }

            // 6. Arabic System Tray Icon & Context Menu
            {
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
                let player_item =
                    MenuItem::with_id(app, "player", "فتح مشغل مثاني", true, None::<&str>)?;
                let settings_item = MenuItem::with_id(
                    app,
                    "settings",
                    "إعدادات الجزيرة والمظهر",
                    true,
                    None::<&str>,
                )?;
                let restart_item =
                    MenuItem::with_id(app, "restart", "إعادة تشغيل مثاني", true, None::<&str>)?;
                let quit_item =
                    MenuItem::with_id(app, "quit", "إنهاء مثاني", true, None::<&str>)?;
                let menu = Menu::with_items(
                    app,
                    &[&player_item, &settings_item, &restart_item, &quit_item],
                )?;
                let ah = app.handle().clone();
                TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip("مثاني — مشغل القرآن الكريم")
                    .menu(&menu)
                    .on_menu_event(move |_, event| match event.id().as_ref() {
                        "player" => {
                            crate::commands::open_player_window(ah.clone());
                        }
                        "settings" => {
                            crate::commands::open_settings_window(ah.clone());
                        }
                        "restart" => {
                            diagnostics::record("restart", "source=tray");
                            SHUTTING_DOWN.store(true, Ordering::Relaxed);
                            crate::commands::release_appbars(&ah);
                            if let Some(w) = ah.get_webview_window("settings") {
                                let _ = w.destroy();
                            }
                            if let Some(w) = ah.get_webview_window("player") {
                                let _ = w.destroy();
                            }
                            close_single_instance_handles();
                            ah.restart();
                        }
                        "quit" => {
                            crate::commands::shutdown_and_exit(&ah);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            crate::commands::open_player_window(tray.app_handle().clone());
                        }
                    })
                    .build(app)?;
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Mathani application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            diagnostics::record("exit", "releasing Notch AppBar");
            crate::commands::release_appbars(app_handle);
        }
    });
}
