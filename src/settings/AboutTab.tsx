import { FileDown, Upload, ShieldCheck } from "lucide-react";
import { SettingRow } from "./SettingRow";

interface AboutTabProps {
	appVersion: string;
	exportStatus: string;
	importStatus: string;
	handleExportSettings: () => void;
	handleImportSettings: () => void;
}

export function AboutTab({
	appVersion,
	exportStatus,
	importStatus,
	handleExportSettings,
	handleImportSettings
}: AboutTabProps) {
	const getExportLabel = () => {
		if (exportStatus === "exporting") return "جارٍ التصدير...";
		if (exportStatus === "success") return "تم التصدير بنجاح!";
		if (exportStatus === "error") return "تعذّر التصدير، حاول مجدداً";
		return "تصدير الإعدادات";
	};

	const getImportLabel = () => {
		if (importStatus === "importing") return "جارٍ الاستيراد...";
		if (importStatus === "success") return "تم الاستيراد بنجاح!";
		if (importStatus === "error") return "تعذّر قراءة ملف الإعدادات";
		return "استيراد الإعدادات";
	};

	return (
		<div className="about-tab-container">
			<div className="about-header">
				<img src="/mathani-logo.svg" className="about-logo" alt="Mathani Logo" draggable={false} />
				<h1 className="about-title" style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
					مَثَانِي
				</h1>
				<p className="about-version">Mathani Quran Player • v{appVersion}</p>
				<p className="about-credit">
					مشغل القرآن الكريم المكتبي لنظام ويندوز مع الجزيرة التفاعلية العلوية — يعمل محلياً بالكامل (Offline)
				</p>
			</div>

			<div className="setting-group-label">الخصوصية والعمل المحلي</div>
			<div className="setting-group">
				<SettingRow
					icon={ShieldCheck}
					label="تشغيل محلي مستقل ١٠٠٪"
					desc="جميع التلاوات والإعدادات والعلامات المرجعية محفوظة على جهازك فقط دون المساس بشريط المهام"
					divider={false}
				/>
			</div>

			<div className="setting-group-label setting-group-label--spaced">النسخ الاحتياطي للإعدادات</div>
			<div className="setting-group">
				<SettingRow
					icon={FileDown}
					label={getExportLabel()}
					desc="حفظ إعدادات المظهر والجزيرة في ملف JSON"
					action
					onClick={handleExportSettings}
				/>
				<SettingRow
					icon={Upload}
					label={getImportLabel()}
					desc="استرجاع إعدادات محفوظة مسبقاً"
					action
					divider={false}
					onClick={handleImportSettings}
				/>
			</div>
		</div>
	);
}
