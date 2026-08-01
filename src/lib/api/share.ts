import { decodePolyline } from './valhalla';
import type { LngLat } from '$lib/geo';

/**
 * Share links encode only the waypoints (not full geometry) in the URL hash —
 * the receiving end re-snaps to roads via Valhalla. Keeps URLs short.
 *
 * Format: #r=<polyline5, uri-encoded>[+|*]  (+ = closed loop, * = out-and-back mirror)
 */

function encodeValue(v: number): string {
	let s = '';
	v = v < 0 ? ~(v << 1) : v << 1;
	while (v >= 0x20) {
		s += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
		v >>= 5;
	}
	s += String.fromCharCode(v + 63);
	return s;
}

export function encodePolyline(points: LngLat[], precision = 5): string {
	let output = '';
	let prevLat = 0;
	let prevLng = 0;
	const f = 10 ** precision;
	for (const [lng, lat] of points) {
		const ilat = Math.round(lat * f);
		const ilng = Math.round(lng * f);
		output += encodeValue(ilat - prevLat) + encodeValue(ilng - prevLng);
		prevLat = ilat;
		prevLng = ilng;
	}
	return output;
}

export function buildShareHash(waypoints: LngLat[], closed: boolean, mirrored: boolean): string {
	const suffix = mirrored ? '*' : closed ? '+' : '';
	return `#r=${encodeURIComponent(encodePolyline(waypoints))}${suffix}`;
}

export function parseShareHash(
	hash: string
): { waypoints: LngLat[]; closed: boolean; mirrored: boolean } | null {
	const m = hash.match(/^#r=([^+*]+)([+*])?$/);
	if (!m) return null;
	try {
		const waypoints = decodePolyline(decodeURIComponent(m[1]), 5);
		if (!waypoints.length) return null;
		return { waypoints, closed: !!m[2], mirrored: m[2] === '*' };
	} catch {
		return null;
	}
}
