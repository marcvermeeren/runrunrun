/** External endpoints — swap here if you ever self-host or change providers. */

/** Valhalla public demo server (FOSSGIS) — global OSM data, pedestrian profile, no API key */
export const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';

/** AWS Open Data Terrarium elevation tiles — free, no key, CORS-enabled */
export const elevationTileUrl = (z: number, x: number, y: number) =>
	`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

/** OpenFreeMap vector tile styles — free, no key */
export const MAP_STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
export const MAP_STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';

/** localStorage key for saved routes */
export const STORAGE_KEY = 'runrunrun:routes:v1';

/** localStorage key for last map position */
export const VIEW_KEY = 'runrunrun:view';
