import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { getVersion } from "@tauri-apps/api/app";
import { useSettingsSync } from "../hooks/useSettingsSync";
import { reloadIfMirrorWasStale } from "../hooks/settingsMirror";
import { hexToHsl } from "../theme";
import type { WidgetConfig } from "./types";

function readBool(val: string | null): boolean {
	return val === "true";
}

export function useSettings() {
	const [saveError, setSaveError] = useState(
		() => sessionStorage.getItem("bloom-settings-save-error") !== null
	);
	const [saveErrorDetail, setSaveErrorDetail] = useState(
		() => sessionStorage.getItem("bloom-settings-save-error-detail") || ""
	);
	const saveQueue = useRef<Promise<void>>(Promise.resolve());
	const saveFailed = useRef(false);
	const [autostart, setAutostart] = useState(false);
	const [weatherEnabled, setWeatherEnabled] = useState(false);
	const [calendarEnabled, setCalendarEnabled] = useState(true);
	const [timerSoundEnabled, setTimerSoundEnabled] = useState(
		() => localStorage.getItem("bloom-timer-sound-enabled") !== "false"
	);
	const [musicModeEnabled, setMusicModeEnabled] = useState(true);
	const [notchRememberPanel, setNotchRememberPanel] = useState(
		() =>
			(localStorage.getItem("bloom-notch-remember-panel") ??
				localStorage.getItem("bloom-notch-click-to-open")) !== "false"
	);
	const [notchDefaultPanel, setNotchDefaultPanel] = useState<"calendar" | "command-center">(() =>
		localStorage.getItem("bloom-notch-default-panel") === "command-center"
			? "command-center"
			: "calendar"
	);
	const [musicCompactNotch, setMusicCompactNotch] = useState(true);
	const [shelfPersist, setShelfPersist] = useState(
		() => localStorage.getItem("bloom-shelf-persist") === "true"
	);
	const [mediaAmbienceEnabled, setMediaAmbienceEnabled] = useState(true);
	const [mediaCompactGlowEnabled, setMediaCompactGlowEnabled] = useState(true);
	const [mediaLayout, setMediaLayout] = useState<"classic" | "compact">(
		() => (localStorage.getItem("bloom-media-layout") as "classic" | "compact") || "classic"
	);
	const [cornersEnabled, setCornersEnabled] = useState(
		() => localStorage.getItem("bloom-corners-enabled") === "true"
	);
	const [timeFormat24h, setTimeFormat24h] = useState(
		() => localStorage.getItem("bloom-time-format-24h") === "true"
	);
	const [tempUnitFahrenheit, setTempUnitFahrenheit] = useState(false);
	const [cityName, setCityName] = useState("");
	const [citySearchResults, setCitySearchResults] = useState<
		Array<{ name: string; country: string; latitude: number; longitude: number }>
	>([]);
	const [showCityDropdown, setShowCityDropdown] = useState(false);
	const [statusWidgets, setStatusWidgets] = useState<WidgetConfig>({
		left: ["cpu"],
		right: ["battery"]
	});
	const [notchMode, setNotchMode] = useState("fixed");
	const [notchEdgeDelay, setNotchEdgeDelay] = useState(() => {
		const val = localStorage.getItem("bloom-notch-edge-delay");
		return val !== null ? parseInt(val) : 200;
	});
	const [lowBatteryThreshold, setLowBatteryThreshold] = useState(20);
	const [appVersion, setAppVersion] = useState("1.0.0");
	const [scale, setScale] = useState(() =>
		parseFloat(localStorage.getItem("bloom-scale") || "1.0")
	);
	const [themeMode, setThemeMode] = useState(
		() => localStorage.getItem("bloom-theme-mode") || "dark"
	);
	const [themeColor, setThemeColor] = useState(
		() => localStorage.getItem("bloom-theme-color") || "#10b981"
	);
	const [themeOpacity, setThemeOpacity] = useState(() => {
		const val = localStorage.getItem("bloom-theme-opacity");
		return val !== null ? parseFloat(val) : 0.84;
	});
	const [themeSaturation, setThemeSaturation] = useState(() => {
		const val = localStorage.getItem("bloom-theme-saturation");
		return val !== null ? parseFloat(val) : 0.5;
	});
	const [themeBrightness, setThemeBrightness] = useState(() => {
		const val = localStorage.getItem("bloom-theme-brightness");
		return val !== null ? parseFloat(val) : 0.15;
	});
	const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "success" | "error">(
		"idle"
	);
	const [importStatus, setImportStatus] = useState<"idle" | "importing" | "success" | "error">(
		"idle"
	);

	const loadAllSettings = useCallback(async () => {
		try {
			const settings: Record<string, string> = await invoke("load_settings");
			if (await reloadIfMirrorWasStale(settings)) return;
			const getVal = (key: string) => {
				const val = settings[key];
				if (val !== undefined && val !== null) return String(val);
				return localStorage.getItem(key);
			};

			const apply = <T>(
				val: string | null,
				setter: (v: T) => void,
				transform: (v: string) => T
			) => {
				if (val !== null) setter(transform(val));
			};

			apply(getVal("bloom-weather-enabled"), setWeatherEnabled, readBool);
			apply(getVal("bloom-calendar-enabled"), setCalendarEnabled, readBool);
			apply(getVal("bloom-timer-sound-enabled"), setTimerSoundEnabled, readBool);
			apply(getVal("bloom-music-mode-enabled"), setMusicModeEnabled, readBool);
			apply(
				getVal("bloom-notch-remember-panel") ?? getVal("bloom-notch-click-to-open"),
				setNotchRememberPanel,
				readBool
			);
			apply(getVal("bloom-notch-default-panel"), setNotchDefaultPanel, (v) =>
				v === "command-center" ? "command-center" : "calendar"
			);
			apply(getVal("bloom-music-compact-notch"), setMusicCompactNotch, readBool);
			apply(getVal("bloom-shelf-persist"), setShelfPersist, readBool);
			apply(getVal("bloom-media-ambience-enabled"), setMediaAmbienceEnabled, readBool);
			apply(getVal("bloom-media-compact-glow-enabled"), setMediaCompactGlowEnabled, readBool);
			apply(getVal("bloom-corners-enabled"), setCornersEnabled, readBool);
			apply(getVal("bloom-time-format-24h"), setTimeFormat24h, readBool);
			apply(getVal("bloom-media-layout"), setMediaLayout, (v) =>
				v === "compact" ? "compact" : "classic"
			);
			apply(getVal("bloom-notch-mode"), setNotchMode, (v) => (v === "auto-hide" ? "smart" : v));
			apply(getVal("bloom-notch-edge-delay"), setNotchEdgeDelay, parseInt);
			apply(getVal("bloom-low-battery-threshold"), setLowBatteryThreshold, parseInt);
			apply(getVal("bloom-scale"), setScale, parseFloat);
			apply(getVal("bloom-theme-mode"), setThemeMode, (v) => v);
			apply(getVal("bloom-theme-color"), setThemeColor, (v) => v);
			apply(getVal("bloom-theme-opacity"), setThemeOpacity, parseFloat);
			apply(getVal("bloom-theme-saturation"), setThemeSaturation, parseFloat);
			apply(getVal("bloom-theme-brightness"), setThemeBrightness, parseFloat);
			apply(getVal("bloom-temp-unit"), setTempUnitFahrenheit, (v) => v === "fahrenheit");
			apply(getVal("bloom-weather-city"), setCityName, (v) => v);

			const widgetsVal = getVal("bloom-status-widgets");
			if (widgetsVal) {
				try {
					const parsed = JSON.parse(widgetsVal);
					if (parsed && Array.isArray(parsed.left) && Array.isArray(parsed.right)) {
						setStatusWidgets(parsed);
					}
				} catch {}
			}
		} catch (e) {
			console.error("Failed to load settings:", e);
		}
	}, []);

	const saveSetting = (key: string, value: string | null): Promise<boolean> => {
		const operation = saveQueue.current.then(async () => {
			if (saveFailed.current) return false;
			try {
				await invoke<void>("save_setting", { key, value });
			} catch (error) {
				console.error(`Failed to save ${key}:`, error);
				saveFailed.current = true;
				sessionStorage.setItem("bloom-settings-save-error", "true");
				sessionStorage.setItem("bloom-settings-save-error-detail", String(error));
				setSaveErrorDetail(String(error));
				setSaveError(true);
				return false;
			}
			try {
				if (value === null) localStorage.removeItem(key);
				else localStorage.setItem(key, value);
				sessionStorage.removeItem("bloom-settings-save-error");
				sessionStorage.removeItem("bloom-settings-save-error-detail");
			} catch {}
			setSaveError(false);
			return true;
		});
		saveQueue.current = operation.then(() => {});
		return operation;
	};

	const saveLocation = (
		key: "bloom-weather-lat" | "bloom-weather-lon",
		value: string | null
	): Promise<boolean> => {
		return saveSetting(key, value);
	};

	const dismissSaveError = () => {
		sessionStorage.removeItem("bloom-settings-save-error");
		sessionStorage.removeItem("bloom-settings-save-error-detail");
		setSaveErrorDetail("");
		setSaveError(false);
	};

	useEffect(() => {
		loadAllSettings();
		isEnabled()
			.then(setAutostart)
			.catch(() => {});
		getVersion()
			.then((ver) => setAppVersion(ver || "1.0.0"))
			.catch(() => setAppVersion("1.0.0"));
	}, [loadAllSettings]);

	useSettingsSync({
		"bloom-notch-mode": setNotchMode,
		"bloom-notch-edge-delay": setNotchEdgeDelay,
		"bloom-weather-enabled": setWeatherEnabled,
		"bloom-calendar-enabled": setCalendarEnabled,
		"bloom-timer-sound-enabled": setTimerSoundEnabled,
		"bloom-music-mode-enabled": setMusicModeEnabled,
		"bloom-notch-remember-panel": setNotchRememberPanel,
		"bloom-notch-default-panel": (v: unknown) =>
			setNotchDefaultPanel(v === "command-center" ? "command-center" : "calendar"),
		"bloom-music-compact-notch": setMusicCompactNotch,
		"bloom-media-ambience-enabled": setMediaAmbienceEnabled,
		"bloom-media-compact-glow-enabled": setMediaCompactGlowEnabled,
		"bloom-media-layout": setMediaLayout,
		"bloom-corners-enabled": setCornersEnabled,
		"bloom-time-format-24h": setTimeFormat24h,
		"bloom-low-battery-threshold": setLowBatteryThreshold,
		"bloom-scale": setScale,
		"bloom-temp-unit": (v) => setTempUnitFahrenheit(v === "fahrenheit"),
		"bloom-theme-mode": setThemeMode,
		"bloom-theme-color": setThemeColor,
		"bloom-theme-opacity": setThemeOpacity,
		"bloom-theme-saturation": setThemeSaturation,
		"bloom-theme-brightness": setThemeBrightness,
		"bloom-weather-city": (v) => setCityName(v || "")
	});

	useEffect(() => {
		const unlisten = listen<string>("system-accent-changed", (event) => {
			const mode = localStorage.getItem("bloom-theme-mode") || "dark";
			if (mode === "adaptive") {
				try {
					const hsl = hexToHsl(event.payload);
					setThemeSaturation(hsl.s / 100);
					setThemeBrightness(hsl.l / 100);
				} catch {}
			}
		});
		return () => {
			unlisten.then((fn) => fn());
		};
	}, []);

	const toggleAutostart = async () => {
		try {
			const currentlyEnabled = await isEnabled();
			if (currentlyEnabled) {
				await disable();
				setAutostart(false);
			} else {
				await enable();
				setAutostart(true);
			}
		} catch {}
	};

	const toggleWeather = () => {
		const next = !weatherEnabled;
		setWeatherEnabled(next);
		saveSetting("bloom-weather-enabled", String(next));
	};

	const toggleCalendar = () => {
		const next = !calendarEnabled;
		setCalendarEnabled(next);
		saveSetting("bloom-calendar-enabled", String(next));
	};

	const toggleTimerSound = () => {
		const next = !timerSoundEnabled;
		setTimerSoundEnabled(next);
		saveSetting("bloom-timer-sound-enabled", String(next));
	};

	const toggleMusicMode = () => {
		const next = !musicModeEnabled;
		setMusicModeEnabled(next);
		saveSetting("bloom-music-mode-enabled", String(next));
	};

	const toggleNotchRememberPanel = () => {
		const next = !notchRememberPanel;
		setNotchRememberPanel(next);
		saveSetting("bloom-notch-remember-panel", String(next));
	};

	const changeNotchDefaultPanel = (panel: "calendar" | "command-center") => {
		setNotchDefaultPanel(panel);
		saveSetting("bloom-notch-default-panel", panel);
	};

	const toggleMusicCompactNotch = () => {
		const next = !musicCompactNotch;
		setMusicCompactNotch(next);
		saveSetting("bloom-music-compact-notch", String(next));
	};

	const toggleShelfPersist = () => {
		const next = !shelfPersist;
		setShelfPersist(next);
		saveSetting("bloom-shelf-persist", String(next));
	};

	const toggleMediaLayout = (layout: "classic" | "compact") => {
		setMediaLayout(layout);
		saveSetting("bloom-media-layout", layout);
	};

	const toggleAmbience = () => {
		const next = !mediaAmbienceEnabled;
		setMediaAmbienceEnabled(next);
		saveSetting("bloom-media-ambience-enabled", String(next));
	};

	const toggleCompactGlow = () => {
		const next = !mediaCompactGlowEnabled;
		setMediaCompactGlowEnabled(next);
		saveSetting("bloom-media-compact-glow-enabled", String(next));
	};

	const toggleCorners = () => {
		const next = !cornersEnabled;
		setCornersEnabled(next);
		saveSetting("bloom-corners-enabled", String(next));
	};

	const toggleTimeFormat24h = () => {
		const next = !timeFormat24h;
		setTimeFormat24h(next);
		saveSetting("bloom-time-format-24h", String(next));
	};

	const toggleTempUnit = () => {
		const next = !tempUnitFahrenheit;
		setTempUnitFahrenheit(next);
		saveSetting("bloom-temp-unit", next ? "fahrenheit" : "celsius");
	};

	const setNotchModeValue = (newMode: string) => {
		setNotchMode(newMode);
		saveSetting("bloom-notch-mode", newMode);
		invoke("change_notch_mode", { mode: newMode }).catch(() => {});
	};

	const handleNotchEdgeDelayChange = (val: number) => {
		setNotchEdgeDelay(val);
		saveSetting("bloom-notch-edge-delay", val.toString());
	};

	const handleThresholdChange = (val: number) => {
		setLowBatteryThreshold(val);
		saveSetting("bloom-low-battery-threshold", val.toString());
	};

	const handleScaleChange = (val: number) => {
		setScale(val);
		saveSetting("bloom-scale", val.toString());
	};

	const handleWidgetsChange = (config: WidgetConfig) => {
		setStatusWidgets(config);
		saveSetting("bloom-status-widgets", JSON.stringify(config));
	};

	const handleThemeModeChange = async (mode: string) => {
		setThemeMode(mode);
		saveSetting("bloom-theme-mode", mode);

		if (mode === "adaptive") {
			try {
				const accentHex = await invoke<string>("get_system_accent_color");
				const hsl = hexToHsl(accentHex);
				setThemeSaturation(hsl.s / 100);
				saveSetting("bloom-theme-saturation", String(hsl.s / 100));
				setThemeBrightness(hsl.l / 100);
				saveSetting("bloom-theme-brightness", String(hsl.l / 100));
			} catch {}
		}
	};

	const handleThemeColorChange = (color: string) => {
		setThemeColor(color);
		saveSetting("bloom-theme-color", color);
		try {
			const hsl = hexToHsl(color);
			setThemeSaturation(hsl.s / 100);
			saveSetting("bloom-theme-saturation", String(hsl.s / 100));
			setThemeBrightness(hsl.l / 100);
			saveSetting("bloom-theme-brightness", String(hsl.l / 100));
		} catch {}
	};

	const handleOpacityChange = (value: number) => {
		setThemeOpacity(value);
		saveSetting("bloom-theme-opacity", String(value));
	};

	const handleSaturationChange = (value: number) => {
		setThemeSaturation(value);
		saveSetting("bloom-theme-saturation", String(value));
	};

	const handleBrightnessChange = (value: number) => {
		setThemeBrightness(value);
		saveSetting("bloom-theme-brightness", String(value));
	};

	const selectCity = async (city: {
		name: string;
		country: string;
		latitude: number;
		longitude: number;
	}) => {
		setCityName(city.name);
		setShowCityDropdown(false);
		setCitySearchResults([]);
		const saved =
			(await saveLocation("bloom-weather-lat", city.latitude.toString())) &&
			(await saveLocation("bloom-weather-lon", city.longitude.toString())) &&
			(await saveSetting("bloom-weather-city", city.name));
		if (saved) emit("weather-refresh", { lat: city.latitude, lon: city.longitude });
	};

	const handleCityClear = async () => {
		setCityName("");
		setShowCityDropdown(false);
		setCitySearchResults([]);
		const saved =
			(await saveLocation("bloom-weather-lat", null)) &&
			(await saveLocation("bloom-weather-lon", null)) &&
			(await saveSetting("bloom-weather-city", null));
		if (saved) emit("weather-refresh", true);
	};

	const resetToDefaults = async () => {
		try {
			const { ask } = await import("@tauri-apps/plugin-dialog");
			const confirmed = await ask(
				"سيتم استعادة الإعدادات الافتراضية للجزيرة التفاعلية والمظهر وإعادة تشغيل مثاني (مع الاحتفاظ بمكتبة القرآن الكريم والعلامات المرجعية).",
				{
					title: "استعادة الإعدادات الافتراضية",
					kind: "warning",
					okLabel: "استعادة وإعادة تشغيل",
					cancelLabel: "إلغاء"
				}
			);
			if (!confirmed) return;

			await invoke("reset_settings");
			const keep = new Set(["bloom-first-run", "bloom-app-version"]);
			for (const key of Object.keys(localStorage)) {
				if (key.startsWith("bloom-") && !keep.has(key)) localStorage.removeItem(key);
			}
			await invoke("restart_bloom").catch(console.error);
		} catch (e) {
			console.error("Reset failed:", e);
		}
	};

	const handleExportSettings = async () => {
		setExportStatus("exporting");
		try {
			const filePath = await invoke<string | null>("export_settings_to_file");
			if (filePath) {
				setExportStatus("success");
				setTimeout(() => setExportStatus("idle"), 2000);
			} else {
				setExportStatus("idle");
			}
		} catch {
			setExportStatus("error");
			setTimeout(() => setExportStatus("idle"), 3000);
		}
	};

	const handleImportSettings = async () => {
		setImportStatus("importing");
		try {
			const filePath = await invoke<string | null>("import_settings_from_file");
			if (filePath) {
				await loadAllSettings();
				setImportStatus("success");
				setTimeout(() => setImportStatus("idle"), 2000);
			} else {
				setImportStatus("idle");
			}
		} catch {
			setImportStatus("error");
			setTimeout(() => setImportStatus("idle"), 3000);
		}
	};

	return {
		saveError,
		saveErrorDetail,
		dismissSaveError,
		autostart,
		toggleAutostart,
		lowBatteryThreshold,
		handleThresholdChange,
		timeFormat24h,
		toggleTimeFormat24h,
		scale,
		handleScaleChange,
		cornersEnabled,
		toggleCorners,
		themeMode,
		handleThemeModeChange,
		themeColor,
		handleThemeColorChange,
		themeOpacity,
		handleOpacityChange,
		themeSaturation,
		handleSaturationChange,
		themeBrightness,
		handleBrightnessChange,
		notchMode,
		setNotchModeValue,
		notchEdgeDelay,
		handleNotchEdgeDelayChange,
		calendarEnabled,
		toggleCalendar,
		timerSoundEnabled,
		toggleTimerSound,
		musicModeEnabled,
		toggleMusicMode,
		notchRememberPanel,
		toggleNotchRememberPanel,
		notchDefaultPanel,
		changeNotchDefaultPanel,
		musicCompactNotch,
		toggleMusicCompactNotch,
		shelfPersist,
		toggleShelfPersist,
		mediaLayout,
		toggleMediaLayout,
		mediaAmbienceEnabled,
		toggleAmbience,
		mediaCompactGlowEnabled,
		toggleCompactGlow,
		weatherEnabled,
		toggleWeather,
		tempUnitFahrenheit,
		toggleTempUnit,
		cityName,
		setCityName,
		citySearchResults,
		showCityDropdown,
		setShowCityDropdown,
		selectCity,
		handleCityClear,
		statusWidgets,
		handleWidgetsChange,
		appVersion,
		exportStatus,
		importStatus,
		handleExportSettings,
		handleImportSettings,
		restartBloom: () => invoke("restart_bloom"),
		resetToDefaults,
		quitBloom: () => invoke("quit_bloom")
	};
}
