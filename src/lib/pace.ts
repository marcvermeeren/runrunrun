/** Shared pace/time helpers for the bar readout and the pace editor */

/** Parse "m:ss" / "h:mm:ss" / plain minutes into seconds */
export function parseTime(s: string): number | null {
	const parts = s.trim().split(':').map(Number);
	if (parts.some((p) => Number.isNaN(p) || p < 0) || parts.length > 3 || !s.trim()) return null;
	let sec = 0;
	for (const p of parts) sec = sec * 60 + p;
	return sec > 0 ? sec : null;
}

/** Format seconds as "m:ss" or "h:mm:ss" */
export function fmtTime(sec: number): string {
	sec = Math.round(sec);
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	const s = sec % 60;
	return h
		? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
		: `${m}:${String(s).padStart(2, '0')}`;
}
