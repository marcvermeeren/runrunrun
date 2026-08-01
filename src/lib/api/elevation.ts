import { elevationTileUrl } from '$lib/config';
import { pointAt, type LngLat } from '$lib/geo';

export interface ElevSample {
	/** distance along route in km */
	d: number;
	/** elevation in meters */
	e: number;
}

export interface ElevStats {
	ascent: number;
	descent: number;
	min: number;
	max: number;
}

const Z = 13; // tile zoom — good balance of detail vs number of fetches

const tileCache = new Map<string, Promise<ImageData | null>>();
let canvas: HTMLCanvasElement | null = null;

function tileFor(lng: number, lat: number) {
	const n = 2 ** Z;
	const latRad = (lat * Math.PI) / 180;
	const fx = ((lng + 180) / 360) * n;
	const fy =
		((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
	const x = Math.floor(fx);
	const y = Math.floor(fy);
	return {
		x,
		y,
		px: Math.min(255, Math.floor((fx - x) * 256)),
		py: Math.min(255, Math.floor((fy - y) * 256))
	};
}

async function fetchTile(z: number, x: number, y: number): Promise<ImageData | null> {
	try {
		const res = await fetch(elevationTileUrl(z, x, y), { mode: 'cors' });
		if (!res.ok) return null;
		const bmp = await createImageBitmap(await res.blob());
		if (!canvas) {
			canvas = document.createElement('canvas');
			canvas.width = 256;
			canvas.height = 256;
		}
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return null;
		ctx.drawImage(bmp, 0, 0);
		return ctx.getImageData(0, 0, 256, 256);
	} catch {
		return null;
	}
}

function loadTile(x: number, y: number): Promise<ImageData | null> {
	const key = `${x}/${y}`;
	if (!tileCache.has(key)) tileCache.set(key, fetchTile(Z, x, y));
	return tileCache.get(key)!;
}

/**
 * Sample elevation along a route line using free Terrarium terrain tiles.
 * Returns null if tiles can't be loaded (offline, CORS, …).
 */
export async function sampleElevations(
	line: LngLat[],
	distanceKm: number
): Promise<ElevSample[] | null> {
	if (line.length < 2 || distanceKm <= 0) return null;

	const n = Math.max(30, Math.min(200, Math.round(distanceKm * 20)));
	const pts = [];
	for (let i = 0; i <= n; i++) {
		const d = (distanceKm * i) / n;
		const [lng, lat] = pointAt(line, d);
		pts.push({ d, t: tileFor(lng, lat) });
	}

	// kick off all tile fetches (deduped + cached)
	const tiles = new Map<string, Promise<ImageData | null>>();
	for (const p of pts) {
		const key = `${p.t.x}/${p.t.y}`;
		if (!tiles.has(key)) tiles.set(key, loadTile(p.t.x, p.t.y));
	}

	const out: ElevSample[] = [];
	for (const p of pts) {
		const img = await tiles.get(`${p.t.x}/${p.t.y}`)!;
		if (!img) return null;
		const idx = (p.t.py * 256 + p.t.px) * 4;
		const r = img.data[idx];
		const g = img.data[idx + 1];
		const b = img.data[idx + 2];
		out.push({ d: p.d, e: r * 256 + g + b / 256 - 32768 }); // Terrarium decoding
	}
	return out;
}

/** Smoothed ascent/descent + min/max from samples */
export function elevationStats(samples: ElevSample[]): ElevStats {
	const vals = samples.map((s) => s.e);
	// 5-point moving average to filter DEM noise
	const sm = vals.map((_, i) => {
		const lo = Math.max(0, i - 2);
		const hi = Math.min(vals.length, i + 3);
		let sum = 0;
		for (let j = lo; j < hi; j++) sum += vals[j];
		return sum / (hi - lo);
	});
	let ascent = 0;
	let descent = 0;
	for (let i = 1; i < sm.length; i++) {
		const d = sm[i] - sm[i - 1];
		if (d > 0) ascent += d;
		else descent -= d;
	}
	return { ascent, descent, min: Math.min(...vals), max: Math.max(...vals) };
}
