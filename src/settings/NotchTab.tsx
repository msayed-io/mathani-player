import {
	PanelTop,
	Calendar,
	BellRing,
	BookOpen,
	Minimize2,
	LayoutList,
	Sparkles,
	Circle,
	Timer,
	Archive
} from "lucide-react";
import { SettingRow } from "./SettingRow";
import { StatusWidgetConfig } from "../components/StatusWidgetConfig";
import type { WidgetConfig } from "./types";

interface NotchTabProps {
	notchMode: string;
	setNotchModeValue: (mode: string) => void;
	notchEdgeDelay: number;
	handleNotchEdgeDelayChange: (val: number) => void;
	calendarEnabled: boolean;
	toggleCalendar: () => void;
	notchRememberPanel: boolean;
	toggleNotchRememberPanel: () => void;
	notchDefaultPanel: "calendar" | "command-center";
	changeNotchDefaultPanel: (panel: "calendar" | "command-center") => void;
	timerSoundEnabled: boolean;
	toggleTimerSound: () => void;
	musicModeEnabled: boolean;
	toggleMusicMode: () => void;
	musicCompactNotch: boolean;
	toggleMusicCompactNotch: () => void;
	shelfPersist: boolean;
	toggleShelfPersist: () => void;
	mediaLayout: "classic" | "compact";
	toggleMediaLayout: (layout: "classic" | "compact") => void;
	mediaAmbienceEnabled: boolean;
	toggleAmbience: () => void;
	mediaCompactGlowEnabled: boolean;
	toggleCompactGlow: () => void;
	statusWidgets: WidgetConfig;
	handleWidgetsChange: (config: WidgetConfig) => void;
}

export function NotchTab({
	notchMode,
	setNotchModeValue,
	notchEdgeDelay,
	handleNotchEdgeDelayChange,
	calendarEnabled,
	toggleCalendar,
	notchRememberPanel,
	toggleNotchRememberPanel,
	notchDefaultPanel,
	changeNotchDefaultPanel,
	timerSoundEnabled,
	toggleTimerSound,
	musicModeEnabled,
	toggleMusicMode,
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
	statusWidgets,
	handleWidgetsChange
}: NotchTabProps) {
	return (
		<>
			<div className="setting-group-label">الجزيرة التفاعلية العلوية</div>
			<div className="setting-group">
				<SettingRow
					icon={PanelTop}
					label="نمط ظهور الجزيرة"
					desc="اختر طريقة استقرار الجزيرة التفاعلية أعلى سطح المكتب"
				>
					<select
						className="settings-select"
						value={notchMode}
						onChange={(e) => setNotchModeValue(e.target.value)}
					>
						<option value="fixed">ثابت دائماً (Fixed)</option>
						<option value="smart">ذكي تلقائي (Smart)</option>
						<option value="peek">عند التمرير العلوي (Peek)</option>
					</select>
				</SettingRow>

				{notchMode !== "fixed" && (
					<SettingRow
						icon={Timer}
						label="مهلة الاستجابة العلوية"
						desc={
							notchEdgeDelay === 0
								? "إظهار فوري بمجرد ملامسة أعلى الشاشة"
								: `الانتظار ${notchEdgeDelay} مللي ثانية عند حافة الشاشة العلوية`
						}
					>
						<input
							type="range"
							min="0"
							max="800"
							step="50"
							value={notchEdgeDelay}
							onChange={(e) => handleNotchEdgeDelayChange(parseInt(e.target.value))}
							className="settings-slider"
						/>
					</SettingRow>
				)}

				<SettingRow
					icon={PanelTop}
					label="تذكّر آخر لوحة مفتوحة"
					desc="إعادة فتح آخر لوحة استخدمتها عند النقر على الجزيرة"
				>
					<label className="toggle-switch">
						<input type="checkbox" checked={notchRememberPanel} onChange={toggleNotchRememberPanel} />
						<span className="slider"></span>
					</label>
				</SettingRow>

				{!notchRememberPanel && (
					<SettingRow
						icon={PanelTop}
						label="اللوحة الافتراضية"
						desc="اللوحة التي تفتح عند النقر على الجزيرة"
					>
						<select
							className="settings-select"
							value={calendarEnabled ? notchDefaultPanel : "command-center"}
							onChange={(e) =>
								changeNotchDefaultPanel(e.target.value as "calendar" | "command-center")
							}
						>
							<option value="calendar" disabled={!calendarEnabled}>
								التقويم والمؤقت
							</option>
							<option value="command-center">مركز التحكم</option>
						</select>
					</SettingRow>
				)}

				<SettingRow
					icon={Calendar}
					label="التقويم ومؤقت الورد"
					desc="تفعيل عرض التقويم والمؤقت المدمج داخل الجزيرة"
				>
					<label className="toggle-switch">
						<input type="checkbox" checked={calendarEnabled} onChange={toggleCalendar} />
						<span className="slider"></span>
					</label>
				</SettingRow>

				{calendarEnabled && (
					<SettingRow
						icon={BellRing}
						label="تنبيه انتهاء المؤقت"
						desc="إصدار رنين هادئ عند اكتمال الوقت المحدد"
					>
						<label className="toggle-switch">
							<input type="checkbox" checked={timerSoundEnabled} onChange={toggleTimerSound} />
							<span className="slider"></span>
						</label>
					</SettingRow>
				)}

				<SettingRow
					icon={BookOpen}
					label="وضع التلاوة التفاعلي"
					desc="عرض التلاوة القرآنية الجارية وأزرار التحكم داخل الجزيرة"
				>
					<label className="toggle-switch">
						<input type="checkbox" checked={musicModeEnabled} onChange={toggleMusicMode} />
						<span className="slider"></span>
					</label>
				</SettingRow>

				{musicModeEnabled && (
					<>
						<SettingRow
							icon={Minimize2}
							label="العرض المصغر للتلاوة"
							desc="إظهار الموجات الصوتية وهوية السورة في الوضع المدمج"
						>
							<label className="toggle-switch">
								<input
									type="checkbox"
									checked={musicCompactNotch}
									onChange={toggleMusicCompactNotch}
								/>
								<span className="slider"></span>
							</label>
						</SettingRow>

						<SettingRow icon={LayoutList} label="تخطيط مشغل الجزيرة" desc="اختر تصميم التلاوة عند التوسيع">
							<div className="unit-toggle-minimal wide">
								<span
									className={mediaLayout === "classic" ? "active" : ""}
									onClick={() => toggleMediaLayout("classic")}
								>
									كلاسيكي
								</span>
								<span
									className={mediaLayout === "compact" ? "active" : ""}
									onClick={() => toggleMediaLayout("compact")}
								>
									مدمج
								</span>
							</div>
						</SettingRow>

						<SettingRow
							icon={Sparkles}
							label="التوهج المحيطي (Ambient Glow)"
							desc="إضاءة خلفية ناعمة مستوحاة من زخرفة السورة"
						>
							<label className="toggle-switch">
								<input type="checkbox" checked={mediaAmbienceEnabled} onChange={toggleAmbience} />
								<span className="slider"></span>
							</label>
						</SettingRow>

						<SettingRow
							icon={Circle}
							label="توهج المصغرة"
							desc="هالة ضوئية حول شعار السورة عند طي الجزيرة"
							divider={false}
						>
							<label className="toggle-switch">
								<input
									type="checkbox"
									checked={mediaCompactGlowEnabled}
									onChange={toggleCompactGlow}
								/>
								<span className="slider"></span>
							</label>
						</SettingRow>
					</>
				)}
			</div>

			<div className="setting-group-label">رف الملفات السريع</div>
			<div className="setting-group">
				<SettingRow
					icon={Archive}
					label="الاحتفاظ بالملفات"
					desc="بقاء الملفات المودعة في رف الجزيرة بعد إغلاق التطبيق"
					divider={false}
				>
					<label className="toggle-switch">
						<input type="checkbox" checked={shelfPersist} onChange={toggleShelfPersist} />
						<span className="slider"></span>
					</label>
				</SettingRow>
			</div>

			<div className="setting-group-label">أدوات شريط الحالة</div>
			<div className="setting-group">
				<StatusWidgetConfig value={statusWidgets} onChange={handleWidgetsChange} />
			</div>
		</>
	);
}
