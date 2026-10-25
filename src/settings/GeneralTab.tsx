import { Power, Clock, BatteryWarning, RefreshCw, RotateCcw, LogOut } from "lucide-react";
import { SettingRow } from "./SettingRow";

interface GeneralTabProps {
	autostart: boolean;
	toggleAutostart: () => void;
	timeFormat24h: boolean;
	toggleTimeFormat24h: () => void;
	lowBatteryThreshold: number;
	handleThresholdChange: (val: number) => void;
	restartBloom: () => void;
	resetToDefaults: () => void;
	quitBloom: () => void;
}

export function GeneralTab({
	autostart,
	toggleAutostart,
	timeFormat24h,
	toggleTimeFormat24h,
	lowBatteryThreshold,
	handleThresholdChange,
	restartBloom,
	resetToDefaults,
	quitBloom
}: GeneralTabProps) {
	return (
		<>
			<div className="setting-group-label">النظام</div>
			<div className="setting-group">
				<SettingRow
					icon={Power}
					label="التشغيل مع بدء ويندوز"
					desc="تشغيل مثاني والجزيرة التفاعلية تلقائياً عند تسجيل الدخول"
				>
					<label className="toggle-switch">
						<input type="checkbox" checked={autostart} onChange={toggleAutostart} />
						<span className="slider"></span>
					</label>
				</SettingRow>

				<SettingRow icon={Clock} label="تنسيق ٢٤ ساعة" desc="عرض الساعة بنظام ٢٤ ساعة في الجزيرة">
					<label className="toggle-switch">
						<input type="checkbox" checked={timeFormat24h} onChange={toggleTimeFormat24h} />
						<span className="slider"></span>
					</label>
				</SettingRow>

				<SettingRow
					icon={BatteryWarning}
					label="تنبيه انخفاض البطارية"
					desc={`التنبيه عند وصول الشحن إلى ${lowBatteryThreshold}%`}
					divider={false}
				>
					<input
						type="range"
						min="5"
						max="50"
						step="5"
						value={lowBatteryThreshold}
						onChange={(e) => handleThresholdChange(parseInt(e.target.value))}
						className="settings-slider"
					/>
				</SettingRow>
			</div>

			<div className="setting-group-label">التحكم بالتطبيق</div>
			<div className="setting-group">
				<SettingRow
					icon={RotateCcw}
					label="استعادة الإعدادات الافتراضية"
					desc="إعادة ضبط المظهر والجزيرة التفاعلية إلى الوضع الأصلي"
					action
					danger
					onClick={resetToDefaults}
				/>
				<SettingRow
					icon={RefreshCw}
					label="إعادة تشغيل مثاني"
					desc="إعادة تهيئة المشغل والجزيرة التفاعلية"
					action
					onClick={restartBloom}
				/>
				<SettingRow
					icon={LogOut}
					label="إغلاق مثاني بالكامل"
					desc="إنهاء المشغل وإخفاء الجزيرة التفاعلية"
					action
					danger
					onClick={quitBloom}
					divider={false}
				/>
			</div>
		</>
	);
}
