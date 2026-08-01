export type LngLat = [number, number];

const R = 6371; // earth radius km

export function haversineKm(a: LngLat, b: LngLat): number {
	const dLat = ((b[1] - a[1]) * Math.PI) / 180;
	const dLng = ((b[0] - a[0]) * Math.PI) / 180;
	const la1 = (a[1] * Math.PI) / 180;
	const la2 = (b[1] * Math.PI) / 180;
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

export function pathLengthKm(path: LngLat[]): number {
	let total = 0;
	for (let i = 1; i < path.length; i++) total += haversineKm(path[i - 1], path[i]);
	return total;
}

/** Point at `km` distance along the path (linear interpolation within the segment) */
export function pointAt(path: LngLat[], km: number): LngLat {
	let acc = 0;
	for (let i = 1; i < path.length; i++) {
		const seg = haversineKm(path[i - 1], path[i]);
		if (acc + seg >= km) {
			const t = seg === 0 ? 0 : (km - acc) / seg;
			return [
				path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t,
				path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t
			];
		}
		acc += seg;
	}
	return path[path.length - 1];
}
