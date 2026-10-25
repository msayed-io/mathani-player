interface MusicNoteIconProps {
	size?: number;
	className?: string;
}

/**
 * Dignified Quranic Open-Mushaf & Rub-el-Hizb emblem replacing the musical eighth-note,
 * while preserving the exact component contract used by Bloom's Notch & CompactMediaPlayer.
 */
export function MusicNoteIcon({ size = 32, className }: MusicNoteIconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.75"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
		>
			<path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H11a2 2 0 0 1 1 1.73A2 2 0 0 1 13 3h6.5A2.5 2.5 0 0 1 22 5.5v12a1 1 0 0 1-1 1h-6.5a2.5 2.5 0 0 0-2.5 2 2.5 2.5 0 0 0-2.5-2H3a1 1 0 0 1-1-1v-12Z" />
			<path d="M12 4.73V20.5" />
			<path d="M6 8h3" opacity="0.65" />
			<path d="M6 11.5h3" opacity="0.65" />
			<path d="M15 8h3" opacity="0.65" />
			<path d="M15 11.5h3" opacity="0.65" />
		</svg>
	);
}
