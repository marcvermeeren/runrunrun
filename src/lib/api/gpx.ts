import { haversineKm, type LngLat } from '$lib/geo';
import type { ElevSample } from './elevation';

function esc(s: string): string {
	const map: Record<string, string> = {
		'<': '&lt;',
		'>': '&gt;',
		'&': '&amp;',
		"'": '&apos;',
		'"': '&quot;'
	};
	return s.replace(/[<>&'"]/g, (c) => map[c]);
}

/** GPX 1.1 track with elevation when available — importable by Garmin, Strava, watches */
export function toGpx(name: string, line: LngLat[], samples?: ElevSample[] | null): string {
	let eles: number[] | null = null;
	if (samples && samples.length > 1 && line.length > 1) {
		eles = [];
		let acc = 0;
		let si = 0;
		for (let i = 0; i < line.length; i++) {
			if (i > 0) acc += haversineKm(line[i - 1], line[i]);
			while (si < samples.length - 2 && samples[si + 1].d < acc) si++;
			const a = samples[si];
			const b = samples[si + 1];
			eles.push(b && Math.abs(b.d - acc) < Math.abs(a.d - acc) ? b.e : a.e);
		}
	}
	const pts = line
		.map(([lng, lat], i) => {
			const ele = eles ? `\n        <ele>${eles[i].toFixed(1)}</ele>` : '';
			return `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}">${ele}\n      </trkpt>`;
		})
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="runrunrun" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${esc(name)}</name>
  </metadata>
  <trk>
    <name>${esc(name)}</name>
    <type>running</type>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}
