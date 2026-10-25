import { toArabicDigits } from "./quranData";

const PALETTES: ReadonlyArray<[string, string, string]> = [
	["#052e24", "#0d9488", "#6ee7b7"], // Emerald Nabawi
	["#1e1b4b", "#4338ca", "#a5b4fc"], // Midnight Indigo
	["#271705", "#b45309", "#fcd34d"], // Mushaf Gold
	["#0c2438", "#0284c7", "#7dd3fc"], // Andalusian Azure
	["#2a0a18", "#be123c", "#fda4af"], // Yemeni Agate
	["#14261c", "#15803d", "#86efac"], // Rawdah Olive
	["#1f1235", "#7e22ce", "#d8b4fe"]  // Royal Misk
];

const artworkCache = new Map<string, string>();

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

/**
 * Generates a crisp, ornamental SVG Data URI for a Quran Surah.
 * Works 100% offline and feeds directly into both Mathani's UI and Bloom's
 * Dynamic Island (`artwork` + `notch-ambient-glow`).
 */
export function buildSurahArtwork(
	surahNumber: number | null,
	displayTitle: string,
	reciter: string
): string {
	const cacheKey = `${surahNumber ?? 0}|${displayTitle}|${reciter}`;
	const hit = artworkCache.get(cacheKey);
	if (hit) return hit;

	const idx = ((surahNumber ?? displayTitle.length) * 5) % PALETTES.length;
	const [bgDark, bgMid, accent] = PALETTES[idx];
	const numLabel = surahNumber ? toArabicDigits(surahNumber) : "۞";
	const shortTitle = displayTitle.replace(/^سورة\s+/, "").slice(0, 16);

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bgDark}"/>
      <stop offset="65%" stop-color="${bgMid}"/>
      <stop offset="100%" stop-color="${bgDark}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="${bgDark}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="320" height="320" rx="36" fill="url(#bg)"/>
  <rect width="320" height="320" rx="36" fill="url(#glow)"/>
  <g transform="translate(160,160)" stroke="${accent}" fill="none">
    <circle r="126" stroke-opacity="0.16" stroke-width="1.5"/>
    <circle r="112" stroke-opacity="0.22" stroke-width="1" stroke-dasharray="4 6"/>
    <rect x="-78" y="-78" width="156" height="156" rx="10" stroke-opacity="0.26" stroke-width="1.6"/>
    <rect x="-78" y="-78" width="156" height="156" rx="10" transform="rotate(45)" stroke-opacity="0.26" stroke-width="1.6"/>
    <circle r="54" stroke-opacity="0.2" stroke-width="1.2"/>
  </g>
  <text x="160" y="92" text-anchor="middle" fill="${accent}" fill-opacity="0.9" font-family="Segoe UI, Tahoma, sans-serif" font-size="22" font-weight="700">${escapeXml(numLabel)}</text>
  <text x="160" y="176" text-anchor="middle" fill="#ffffff" font-family="Traditional Arabic, Amiri, Segoe UI, Tahoma, sans-serif" font-size="44" font-weight="700">${escapeXml(shortTitle)}</text>
  <text x="160" y="226" text-anchor="middle" fill="#ffffff" fill-opacity="0.72" font-family="Segoe UI, Tahoma, sans-serif" font-size="16" font-weight="500">القرآن الكريم</text>
</svg>`;

	const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
	artworkCache.set(cacheKey, uri);
	return uri;
}
