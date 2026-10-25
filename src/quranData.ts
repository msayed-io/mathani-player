export interface SurahMeta {
	number: number;
	name: string;
	englishName: string;
	revelationType: "meccan" | "medinan";
	ayahs: number;
	juz: number;
}

export const SURAHS: readonly SurahMeta[] = [
	{ number: 1, name: "الفاتحة", englishName: "Al-Fatihah", revelationType: "meccan", ayahs: 7, juz: 1 },
	{ number: 2, name: "البقرة", englishName: "Al-Baqarah", revelationType: "medinan", ayahs: 286, juz: 1 },
	{ number: 3, name: "آل عمران", englishName: "Ali 'Imran", revelationType: "medinan", ayahs: 200, juz: 3 },
	{ number: 4, name: "النساء", englishName: "An-Nisa", revelationType: "medinan", ayahs: 176, juz: 4 },
	{ number: 5, name: "المائدة", englishName: "Al-Ma'idah", revelationType: "medinan", ayahs: 120, juz: 6 },
	{ number: 6, name: "الأنعام", englishName: "Al-An'am", revelationType: "meccan", ayahs: 165, juz: 7 },
	{ number: 7, name: "الأعراف", englishName: "Al-A'raf", revelationType: "meccan", ayahs: 206, juz: 8 },
	{ number: 8, name: "الأنفال", englishName: "Al-Anfal", revelationType: "medinan", ayahs: 75, juz: 9 },
	{ number: 9, name: "التوبة", englishName: "At-Tawbah", revelationType: "medinan", ayahs: 129, juz: 10 },
	{ number: 10, name: "يونس", englishName: "Yunus", revelationType: "meccan", ayahs: 109, juz: 11 },
	{ number: 11, name: "هود", englishName: "Hud", revelationType: "meccan", ayahs: 123, juz: 11 },
	{ number: 12, name: "يوسف", englishName: "Yusuf", revelationType: "meccan", ayahs: 111, juz: 12 },
	{ number: 13, name: "الرعد", englishName: "Ar-Ra'd", revelationType: "medinan", ayahs: 43, juz: 13 },
	{ number: 14, name: "إبراهيم", englishName: "Ibrahim", revelationType: "meccan", ayahs: 52, juz: 13 },
	{ number: 15, name: "الحجر", englishName: "Al-Hijr", revelationType: "meccan", ayahs: 99, juz: 14 },
	{ number: 16, name: "النحل", englishName: "An-Nahl", revelationType: "meccan", ayahs: 128, juz: 14 },
	{ number: 17, name: "الإسراء", englishName: "Al-Isra", revelationType: "meccan", ayahs: 111, juz: 15 },
	{ number: 18, name: "الكهف", englishName: "Al-Kahf", revelationType: "meccan", ayahs: 110, juz: 15 },
	{ number: 19, name: "مريم", englishName: "Maryam", revelationType: "meccan", ayahs: 98, juz: 16 },
	{ number: 20, name: "طه", englishName: "Taha", revelationType: "meccan", ayahs: 135, juz: 16 },
	{ number: 21, name: "الأنبياء", englishName: "Al-Anbiya", revelationType: "meccan", ayahs: 112, juz: 17 },
	{ number: 22, name: "الحج", englishName: "Al-Hajj", revelationType: "medinan", ayahs: 78, juz: 17 },
	{ number: 23, name: "المؤمنون", englishName: "Al-Mu'minun", revelationType: "meccan", ayahs: 118, juz: 18 },
	{ number: 24, name: "النور", englishName: "An-Nur", revelationType: "medinan", ayahs: 64, juz: 18 },
	{ number: 25, name: "الفرقان", englishName: "Al-Furqan", revelationType: "meccan", ayahs: 77, juz: 18 },
	{ number: 26, name: "الشعراء", englishName: "Ash-Shu'ara", revelationType: "meccan", ayahs: 227, juz: 19 },
	{ number: 27, name: "النمل", englishName: "An-Naml", revelationType: "meccan", ayahs: 93, juz: 19 },
	{ number: 28, name: "القصص", englishName: "Al-Qasas", revelationType: "meccan", ayahs: 88, juz: 20 },
	{ number: 29, name: "العنكبوت", englishName: "Al-'Ankabut", revelationType: "meccan", ayahs: 69, juz: 20 },
	{ number: 30, name: "الروم", englishName: "Ar-Rum", revelationType: "meccan", ayahs: 60, juz: 21 },
	{ number: 31, name: "لقمان", englishName: "Luqman", revelationType: "meccan", ayahs: 34, juz: 21 },
	{ number: 32, name: "السجدة", englishName: "As-Sajdah", revelationType: "meccan", ayahs: 30, juz: 21 },
	{ number: 33, name: "الأحزاب", englishName: "Al-Ahzab", revelationType: "medinan", ayahs: 73, juz: 21 },
	{ number: 34, name: "سبأ", englishName: "Saba", revelationType: "meccan", ayahs: 54, juz: 22 },
	{ number: 35, name: "فاطر", englishName: "Fatir", revelationType: "meccan", ayahs: 45, juz: 22 },
	{ number: 36, name: "يس", englishName: "Ya-Sin", revelationType: "meccan", ayahs: 83, juz: 22 },
	{ number: 37, name: "الصافات", englishName: "As-Saffat", revelationType: "meccan", ayahs: 182, juz: 23 },
	{ number: 38, name: "ص", englishName: "Sad", revelationType: "meccan", ayahs: 88, juz: 23 },
	{ number: 39, name: "الزمر", englishName: "Az-Zumar", revelationType: "meccan", ayahs: 75, juz: 23 },
	{ number: 40, name: "غافر", englishName: "Ghafir", revelationType: "meccan", ayahs: 85, juz: 24 },
	{ number: 41, name: "فصلت", englishName: "Fussilat", revelationType: "meccan", ayahs: 54, juz: 24 },
	{ number: 42, name: "الشورى", englishName: "Ash-Shuraa", revelationType: "meccan", ayahs: 53, juz: 25 },
	{ number: 43, name: "الزخرف", englishName: "Az-Zukhruf", revelationType: "meccan", ayahs: 89, juz: 25 },
	{ number: 44, name: "الدخان", englishName: "Ad-Dukhan", revelationType: "meccan", ayahs: 59, juz: 25 },
	{ number: 45, name: "الجاثية", englishName: "Al-Jathiyah", revelationType: "meccan", ayahs: 37, juz: 25 },
	{ number: 46, name: "الأحقاف", englishName: "Al-Ahqaf", revelationType: "meccan", ayahs: 35, juz: 26 },
	{ number: 47, name: "محمد", englishName: "Muhammad", revelationType: "medinan", ayahs: 38, juz: 26 },
	{ number: 48, name: "الفتح", englishName: "Al-Fath", revelationType: "medinan", ayahs: 29, juz: 26 },
	{ number: 49, name: "الحجرات", englishName: "Al-Hujurat", revelationType: "medinan", ayahs: 18, juz: 26 },
	{ number: 50, name: "ق", englishName: "Qaf", revelationType: "meccan", ayahs: 45, juz: 26 },
	{ number: 51, name: "الذاريات", englishName: "Adh-Dhariyat", revelationType: "meccan", ayahs: 60, juz: 26 },
	{ number: 52, name: "الطور", englishName: "At-Tur", revelationType: "meccan", ayahs: 49, juz: 27 },
	{ number: 53, name: "النجم", englishName: "An-Najm", revelationType: "meccan", ayahs: 62, juz: 27 },
	{ number: 54, name: "القمر", englishName: "Al-Qamar", revelationType: "meccan", ayahs: 55, juz: 27 },
	{ number: 55, name: "الرحمن", englishName: "Ar-Rahman", revelationType: "medinan", ayahs: 78, juz: 27 },
	{ number: 56, name: "الواقعة", englishName: "Al-Waqi'ah", revelationType: "meccan", ayahs: 96, juz: 27 },
	{ number: 57, name: "الحديد", englishName: "Al-Hadid", revelationType: "medinan", ayahs: 29, juz: 27 },
	{ number: 58, name: "المجادلة", englishName: "Al-Mujadila", revelationType: "medinan", ayahs: 22, juz: 28 },
	{ number: 59, name: "الحشر", englishName: "Al-Hashr", revelationType: "medinan", ayahs: 24, juz: 28 },
	{ number: 60, name: "الممتحنة", englishName: "Al-Mumtahanah", revelationType: "medinan", ayahs: 13, juz: 28 },
	{ number: 61, name: "الصف", englishName: "As-Saff", revelationType: "medinan", ayahs: 14, juz: 28 },
	{ number: 62, name: "الجمعة", englishName: "Al-Jumu'ah", revelationType: "medinan", ayahs: 11, juz: 28 },
	{ number: 63, name: "المنافقون", englishName: "Al-Munafiqun", revelationType: "medinan", ayahs: 11, juz: 28 },
	{ number: 64, name: "التغابن", englishName: "At-Taghabun", revelationType: "medinan", ayahs: 18, juz: 28 },
	{ number: 65, name: "الطلاق", englishName: "At-Talaq", revelationType: "medinan", ayahs: 12, juz: 28 },
	{ number: 66, name: "التحريم", englishName: "At-Tahrim", revelationType: "medinan", ayahs: 12, juz: 28 },
	{ number: 67, name: "الملك", englishName: "Al-Mulk", revelationType: "meccan", ayahs: 30, juz: 29 },
	{ number: 68, name: "القلم", englishName: "Al-Qalam", revelationType: "meccan", ayahs: 52, juz: 29 },
	{ number: 69, name: "الحاقة", englishName: "Al-Haqqah", revelationType: "meccan", ayahs: 52, juz: 29 },
	{ number: 70, name: "المعارج", englishName: "Al-Ma'arij", revelationType: "meccan", ayahs: 44, juz: 29 },
	{ number: 71, name: "نوح", englishName: "Nuh", revelationType: "meccan", ayahs: 28, juz: 29 },
	{ number: 72, name: "الجن", englishName: "Al-Jinn", revelationType: "meccan", ayahs: 28, juz: 29 },
	{ number: 73, name: "المزمل", englishName: "Al-Muzzammil", revelationType: "meccan", ayahs: 20, juz: 29 },
	{ number: 74, name: "المدثر", englishName: "Al-Muddaththir", revelationType: "meccan", ayahs: 56, juz: 29 },
	{ number: 75, name: "القيامة", englishName: "Al-Qiyamah", revelationType: "meccan", ayahs: 40, juz: 29 },
	{ number: 76, name: "الإنسان", englishName: "Al-Insan", revelationType: "medinan", ayahs: 31, juz: 29 },
	{ number: 77, name: "المرسلات", englishName: "Al-Mursalat", revelationType: "meccan", ayahs: 50, juz: 29 },
	{ number: 78, name: "النبأ", englishName: "An-Naba", revelationType: "meccan", ayahs: 40, juz: 30 },
	{ number: 79, name: "النازعات", englishName: "An-Nazi'at", revelationType: "meccan", ayahs: 46, juz: 30 },
	{ number: 80, name: "عبس", englishName: "'Abasa", revelationType: "meccan", ayahs: 42, juz: 30 },
	{ number: 81, name: "التكوير", englishName: "At-Takwir", revelationType: "meccan", ayahs: 29, juz: 30 },
	{ number: 82, name: "الانفطار", englishName: "Al-Infitar", revelationType: "meccan", ayahs: 19, juz: 30 },
	{ number: 83, name: "المطففين", englishName: "Al-Mutaffifin", revelationType: "meccan", ayahs: 36, juz: 30 },
	{ number: 84, name: "الانشقاق", englishName: "Al-Inshiqaq", revelationType: "meccan", ayahs: 25, juz: 30 },
	{ number: 85, name: "البروج", englishName: "Al-Buruj", revelationType: "meccan", ayahs: 22, juz: 30 },
	{ number: 86, name: "الطارق", englishName: "At-Tariq", revelationType: "meccan", ayahs: 17, juz: 30 },
	{ number: 87, name: "الأعلى", englishName: "Al-A'la", revelationType: "meccan", ayahs: 19, juz: 30 },
	{ number: 88, name: "الغاشية", englishName: "Al-Ghashiyah", revelationType: "meccan", ayahs: 26, juz: 30 },
	{ number: 89, name: "الفجر", englishName: "Al-Fajr", revelationType: "meccan", ayahs: 30, juz: 30 },
	{ number: 90, name: "البلد", englishName: "Al-Balad", revelationType: "meccan", ayahs: 20, juz: 30 },
	{ number: 91, name: "الشمس", englishName: "Ash-Shams", revelationType: "meccan", ayahs: 15, juz: 30 },
	{ number: 92, name: "الليل", englishName: "Al-Layl", revelationType: "meccan", ayahs: 21, juz: 30 },
	{ number: 93, name: "الضحى", englishName: "Ad-Duhaa", revelationType: "meccan", ayahs: 11, juz: 30 },
	{ number: 94, name: "الشرح", englishName: "Ash-Sharh", revelationType: "meccan", ayahs: 8, juz: 30 },
	{ number: 95, name: "التين", englishName: "At-Tin", revelationType: "meccan", ayahs: 8, juz: 30 },
	{ number: 96, name: "العلق", englishName: "Al-'Alaq", revelationType: "meccan", ayahs: 19, juz: 30 },
	{ number: 97, name: "القدر", englishName: "Al-Qadr", revelationType: "meccan", ayahs: 5, juz: 30 },
	{ number: 98, name: "البينة", englishName: "Al-Bayyinah", revelationType: "medinan", ayahs: 8, juz: 30 },
	{ number: 99, name: "الزلزلة", englishName: "Az-Zalzalah", revelationType: "medinan", ayahs: 8, juz: 30 },
	{ number: 100, name: "العاديات", englishName: "Al-'Adiyat", revelationType: "meccan", ayahs: 11, juz: 30 },
	{ number: 101, name: "القارعة", englishName: "Al-Qari'ah", revelationType: "meccan", ayahs: 11, juz: 30 },
	{ number: 102, name: "التكاثر", englishName: "At-Takathur", revelationType: "meccan", ayahs: 8, juz: 30 },
	{ number: 103, name: "العصر", englishName: "Al-'Asr", revelationType: "meccan", ayahs: 3, juz: 30 },
	{ number: 104, name: "الهمزة", englishName: "Al-Humazah", revelationType: "meccan", ayahs: 9, juz: 30 },
	{ number: 105, name: "الفيل", englishName: "Al-Fil", revelationType: "meccan", ayahs: 5, juz: 30 },
	{ number: 106, name: "قريش", englishName: "Quraysh", revelationType: "meccan", ayahs: 4, juz: 30 },
	{ number: 107, name: "الماعون", englishName: "Al-Ma'un", revelationType: "meccan", ayahs: 7, juz: 30 },
	{ number: 108, name: "الكوثر", englishName: "Al-Kawthar", revelationType: "meccan", ayahs: 3, juz: 30 },
	{ number: 109, name: "الكافرون", englishName: "Al-Kafirun", revelationType: "meccan", ayahs: 6, juz: 30 },
	{ number: 110, name: "النصر", englishName: "An-Nasr", revelationType: "medinan", ayahs: 3, juz: 30 },
	{ number: 111, name: "المسد", englishName: "Al-Masad", revelationType: "meccan", ayahs: 5, juz: 30 },
	{ number: 112, name: "الإخلاص", englishName: "Al-Ikhlas", revelationType: "meccan", ayahs: 4, juz: 30 },
	{ number: 113, name: "الفلق", englishName: "Al-Falaq", revelationType: "meccan", ayahs: 5, juz: 30 },
	{ number: 114, name: "الناس", englishName: "An-Nas", revelationType: "meccan", ayahs: 6, juz: 30 }
];

export function normalizeArabic(input: string): string {
	return input
		.toLowerCase()
		.replace(/[\u064B-\u065F\u0670\u0640]/g, "")
		.replace(/[أإآٱ]/g, "ا")
		.replace(/ة/g, "ه")
		.replace(/ى/g, "ي")
		.replace(/ؤ/g, "و")
		.replace(/ئ/g, "ي")
		.trim();
}

export function toArabicDigits(num: number | string): string {
	const map = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
	return String(num).replace(/\d/g, (d) => map[Number(d)] ?? d);
}

const RECITER_ALIASES: Array<[RegExp, string]> = [
	[/minshaw[iy]|المنشاو/i, "الشيخ محمد صديق المنشاوي"],
	[/husar[iy]|hussar[iy]|الحصر/i, "الشيخ محمود خليل الحصري"],
	[/abdul\s*basit|abdel\s*basset|عبد\s*الباسط/i, "الشيخ عبد الباسط عبد الصمد"],
	[/afasy|alafasy|العفاس/i, "الشيخ مشاري راشد العفاسي"],
	[/muaiqly|معيقل/i, "الشيخ ماهر المعيقلي"],
	[/sudais|السديس/i, "الشيخ عبد الرحمن السديس"],
	[/shuraim|الشريم/i, "الشيخ سعود الشريم"],
	[/dosari|dossari|الدوسر/i, "الشيخ ياسر الدوسري"],
	[/qatami|القطام/i, "الشيخ ناصر القطامي"],
	[/islam\s*sobhi|اسلام\s*صبح|إسلام\s*صبح/i, "القارئ إسلام صبحي"],
	[/hazza|بلوش/i, "القارئ هزاع البلوشي"],
	[/ghamdi|الغامد/i, "الشيخ سعد الغامدي"],
	[/ajm[iy]|العجم/i, "الشيخ أحمد بن علي العجمي"],
	[/shatri|الشاطر/i, "الشيخ أبو بكر الشاطري"],
	[/ayyub|ayoub|ايوب|أيوب/i, "الشيخ محمد أيوب"],
	[/ali\s*jaber|علي\s*جابر/i, "الشيخ علي جابر"],
	[/mustafa\s*ismail|مصطفي\s*اسماعيل|مصطفى\s*إسماعيل/i, "الشيخ مصطفى إسماعيل"],
	[/banna|البنا/i, "الشيخ محمود علي البنا"],
	[/tablaw[iy]|الطبلاو/i, "الشيخ محمد محمود الطبلاوي"],
	[/fares\s*abbad|فارس\s*عباد/i, "الشيخ فارس عباد"],
	[/baleela|بليله|بليلة/i, "الشيخ بندر بليلة"],
	[/juhany|الجهن/i, "الشيخ عبد الله عواد الجهني"],
	[/hudhaify|الحذيف/i, "الشيخ علي الحذيفي"],
	[/kamel|عبد\s*الله\s*كامل/i, "الشيخ عبد الله كامل"],
	[/mansour\s*salimi|منصور\s*السالم/i, "الشيخ منصور السالمي"],
	[/raad|رعد\s*الكرد/i, "القارئ رعد محمد الكردي"],
	[/noreen|نورين/i, "الشيخ نورين محمد صديق"]
];

export function detectSurah(
	fileNameNoExt: string,
	id3Title?: string | null,
	id3Track?: number | null
): SurahMeta | null {
	if (id3Track && id3Track >= 1 && id3Track <= 114) {
		return SURAHS[id3Track - 1];
	}

	const combined = `${id3Title ?? ""} ${fileNameNoExt}`.trim();
	const norm = normalizeArabic(combined);

	// 1. Check leading or standalone 3-digit / 1..114 number in filename (e.g., 001.mp3, 018 - Al-Kahf, 114_annas)
	const cleanFile = fileNameNoExt.trim();
	const leadingNum = cleanFile.match(/^(?:surah[\s_-]*|سورة[\s_-]*|سوره[\s_-]*)?0*(\d{1,3})(?:$|[\s_.\-()[\]آاأإع-يa-zA-Z])/i);
	if (leadingNum) {
		const n = parseInt(leadingNum[1], 10);
		if (n >= 1 && n <= 114) {
			return SURAHS[n - 1];
		}
	}

	// 2. Match exact Arabic Surah names (longest first so "المؤمنون" matches before short names like "ق" / "ص")
	const sortedByLen = [...SURAHS].sort((a, b) => b.name.length - a.name.length);
	for (const s of sortedByLen) {
		const sNorm = normalizeArabic(s.name);
		if (sNorm.length >= 3) {
			if (norm.includes(`سوره ${sNorm}`) || norm.includes(sNorm)) {
				return s;
			}
		} else {
			// Single/two-letter Surahs (طه، يس، ص، ق) require word boundary or "سورة" prefix
			const re = new RegExp(`(?:^|[\\s_\\-()]|سوره\\s+)${sNorm}(?:$|[\\s_\\-()])`);
			if (re.test(norm)) {
				return s;
			}
		}
	}

	// 3. Match English transliterated Surah names
	const asciiNorm = combined.toLowerCase().replace(/['`’-]/g, "");
	for (const s of sortedByLen) {
		const enClean = s.englishName.toLowerCase().replace(/['`’-]/g, "");
		const enRoot = enClean.replace(/^al|^an|^as|^at|^adh|^ash|^az|^ar/, "");
		if (enClean.length >= 4 && asciiNorm.includes(enClean)) {
			return s;
		}
		if (enRoot.length >= 5 && asciiNorm.includes(enRoot)) {
			return s;
		}
	}

	// 4. Fallback: trailing 3-digit surah code like mishary_036
	const anyThreeDigit = cleanFile.match(/(?:^|[\s_-])0*(\d{3})(?:$|[\s_-])/);
	if (anyThreeDigit) {
		const n = parseInt(anyThreeDigit[1], 10);
		if (n >= 1 && n <= 114) {
			return SURAHS[n - 1];
		}
	}

	return null;
}

const GENERIC_FOLDER_NAMES = new Set([
	"music",
	"downloads",
	"desktop",
	"documents",
	"audio",
	"mp3",
	"quran",
	"al quran",
	"holy quran",
	"القرآن",
	"القران",
	"القرآن الكريم",
	"القران الكريم",
	"تلاوات",
	"سور",
	"صوتيات"
]);

export function detectReciter(
	filePath: string,
	id3Artist?: string | null,
	id3Album?: string | null
): string {
	const parts = filePath.split(/[\\/]/).filter(Boolean);
	const fileName = parts[parts.length - 1] ?? "";
	const parentDir = parts.length >= 2 ? parts[parts.length - 2] : "";
	const grandParentDir = parts.length >= 3 ? parts[parts.length - 3] : "";

	const searchPool = `${id3Artist ?? ""} ${id3Album ?? ""} ${parentDir} ${grandParentDir} ${fileName}`;
	for (const [pattern, canonical] of RECITER_ALIASES) {
		if (pattern.test(searchPool)) {
			return canonical;
		}
	}

	if (id3Artist && id3Artist.trim().length > 1) {
		const clean = id3Artist.trim();
		if (!GENERIC_FOLDER_NAMES.has(normalizeArabic(clean)) && !/unknown|track/i.test(clean)) {
			return clean;
		}
	}

	if (parentDir && !GENERIC_FOLDER_NAMES.has(normalizeArabic(parentDir)) && !/^[a-z]:$/i.test(parentDir)) {
		return parentDir.replace(/[_-]+/g, " ").trim();
	}

	if (
		grandParentDir &&
		!GENERIC_FOLDER_NAMES.has(normalizeArabic(grandParentDir)) &&
		!/^[a-z]:$/i.test(grandParentDir)
	) {
		return grandParentDir.replace(/[_-]+/g, " ").trim();
	}

	return "تلاوة محلية مباركة";
}
