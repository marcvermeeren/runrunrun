import { VALHALLA_URL } from '$lib/config';
import type { LngLat } from '$lib/geo';

export interface RoutedSegment {
	path: LngLat[];
	distanceKm: number;
	durationSec: number;
}

/** Route between two points snapped to roads/paths using Valhalla's pedestrian profile */
export async function routeSegment(from: LngLat, to: LngLat): Promise<RoutedSegment> {
	const res = await fetch(VALHALLA_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			locations: [
				{ lon: from[0], lat: from[1], type: 'break' },
				{ lon: to[0], lat: to[1], type: 'break' }
			],
			costing: 'pedestrian',
			directions_options: { units: 'kilometers' }
		})
	});
	if (!res.ok) throw new Error(`Routing failed (${res.status})`);
	const data = await res.json();
	const legs: { shape: string }[] = data?.trip?.legs ?? [];
	if (!legs.length) throw new Error('No route found');
	const path = legs
		.map((l) => decodePolyline(l.shape, 6))
		.flatMap((pts, i) => (i === 0 ? pts : pts.slice(1)));
	return {
		path,
		distanceKm: data.trip.summary.length,
		durationSec: data.trip.summary.time
	};
}

/** Decode an encoded polyline (Valhalla uses precision 6) into [lng, lat] pairs */
export function decodePolyline(str: string, precision = 6): LngLat[] {
	let index = 0;
	let lat = 0;
	let lng = 0;
	const f = 10 ** precision;
	const out: LngLat[] = [];
	while (index < str.length) {
		let shift = 0;
		let result = 0;
		let b: number;
		do {
			b = str.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		lat += result & 1 ? ~(result >> 1) : result >> 1;
		shift = 0;
		result = 0;
		do {
			b = str.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		lng += result & 1 ? ~(result >> 1) : result >> 1;
		out.push([lng / f, lat / f]);
	}
	return out;
}
