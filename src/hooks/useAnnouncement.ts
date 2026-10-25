import { useCallback, useState } from "react";

export interface Announcement {
	id: string;
	severity: "info" | "warning";
	title: string;
	body: string;
	url?: string;
}

/**
 * Offline stub for Mathani (100% local offline operation — no external telemetry or endpoints).
 */
export function useAnnouncement() {
	const [announcement] = useState<Announcement | null>(null);
	const [dismissed, setDismissed] = useState(true);

	const dismiss = useCallback(() => {
		setDismissed(true);
	}, []);

	return { announcement, dismissed, dismiss };
}
