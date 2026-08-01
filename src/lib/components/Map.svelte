<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { MAP_STYLE_LIGHT, MAP_STYLE_DARK, VIEW_KEY } from '$lib/config';
	import { route } from '$lib/stores/route.svelte';
	import { theme } from '$lib/stores/theme.svelte';
	import { scrub } from '$lib/stores/scrub.svelte';
	import { pointAt, type LngLat } from '$lib/geo';

	let container: HTMLDivElement;
	let map: maplibregl.Map | null = null;
	let ready = $state(false);
	let currentStyle = '';
	let dragging = false;
	let suppressNextClick = false;

	const accent = () => (theme.isDark ? '#0a84ff' : '#007aff');
	const casing = () => (theme.isDark ? '#1c1c1e' : '#ffffff');
	const styleUrl = () => (theme.isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT);

	function fc(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
		return { type: 'FeatureCollection', features };
	}

	function lineFC(coords: LngLat[]): GeoJSON.FeatureCollection {
		return fc(
			coords.length
				? [
						{
							type: 'Feature',
							properties: {},
							geometry: { type: 'LineString', coordinates: coords }
						}
					]
				: []
		);
	}

	function pointsFC(pts: LngLat[]): GeoJSON.FeatureCollection {
		return fc(
			pts.map((c, i) => ({
				type: 'Feature',
				properties: { i },
				geometry: { type: 'Point', coordinates: c }
			}))
		);
	}

	/** A small numbered pin every full kilometer along the route */
	function splitsFC(geo: LngLat[], dist: number): GeoJSON.FeatureCollection {
		const feats: GeoJSON.Feature[] = [];
		for (let k = 1; k <= Math.floor(dist); k++) {
			feats.push({
				type: 'Feature',
				properties: { km: k },
				geometry: { type: 'Point', coordinates: pointAt(geo, k) }
			});
		}
		return fc(feats);
	}

	function savedView(): { center: LngLat; zoom: number } | null {
		try {
			const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null');
			if (Array.isArray(v?.center) && typeof v?.zoom === 'number') return v;
		} catch {
			/* ignore */
		}
		return null;
	}

	function addLayers() {
		if (!map || map.getSource('route')) return;
		map.addSource('route', { type: 'geojson', data: lineFC(route.geometry) });
		map.addSource('waypoints', { type: 'geojson', data: pointsFC(route.waypoints) });
		map.addSource('splits', { type: 'geojson', data: fc([]) });
		map.addSource('scrub', { type: 'geojson', data: fc([]) });

		map.addLayer({
			id: 'route-casing',
			type: 'line',
			source: 'route',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': casing(), 'line-width': 9, 'line-opacity': 0.9 }
		});
		map.addLayer({
			id: 'route-line',
			type: 'line',
			source: 'route',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': accent(), 'line-width': 4.5 }
		});
		// km splits: subtle dots with an offset label — clearly NOT interactive handles
		map.addLayer({
			id: 'splits-circle',
			type: 'circle',
			source: 'splits',
			paint: {
				'circle-radius': 3.5,
				'circle-color': accent(),
				'circle-opacity': 0.85
			}
		});
		map.addLayer({
			id: 'splits-label',
			type: 'symbol',
			source: 'splits',
			layout: {
				'text-field': ['get', 'km'],
				'text-size': 10,
				'text-font': ['Noto Sans Regular'],
				'text-offset': [0, -1.1],
				'text-allow-overlap': true
			},
			paint: {
				'text-color': accent(),
				'text-halo-color': casing(),
				'text-halo-width': 1.5
			}
		});
		// waypoints: solid filled handles — visibly grabbable
		map.addLayer({
			id: 'waypoints',
			type: 'circle',
			source: 'waypoints',
			paint: {
				'circle-radius': 7,
				'circle-color': accent(),
				'circle-stroke-color': casing(),
				'circle-stroke-width': 2.5
			}
		});
		map.addLayer({
			id: 'scrub',
			type: 'circle',
			source: 'scrub',
			paint: {
				'circle-radius': 7,
				'circle-color': accent(),
				'circle-stroke-color': casing(),
				'circle-stroke-width': 2.5
			}
		});
		// Invisible larger hit area so waypoints are easy to grab
		map.addLayer({
			id: 'waypoints-hit',
			type: 'circle',
			source: 'waypoints',
			paint: { 'circle-radius': 16, 'circle-opacity': 0 }
		});
		ready = true;
	}

	/** Drag an existing waypoint: live straight-line preview, re-route on drop */
	function startDrag(e: maplibregl.MapLayerMouseEvent | maplibregl.MapLayerTouchEvent) {
		if (!map || route.busy || !e.features?.length) return;
		const idx = e.features[0].properties?.i;
		if (typeof idx !== 'number') return;
		e.preventDefault(); // stop map panning
		suppressNextClick = true;
		dragging = true;
		map.dragPan.disable();
		map.getCanvas().style.cursor = 'grabbing';

		const onMove = (ev: { lngLat: maplibregl.LngLat }) =>
			route.previewMove(idx, [ev.lngLat.lng, ev.lngLat.lat]);

		const onUp = (ev?: { lngLat: maplibregl.LngLat }) => {
			if (!map || !dragging) return;
			map.off('mousemove', onMove as (ev: maplibregl.MapMouseEvent) => void);
			map.off('touchmove', onMove as (ev: maplibregl.MapTouchEvent) => void);
			map.dragPan.enable();
			map.getCanvas().style.cursor = '';
			dragging = false;
			const p: LngLat = ev ? [ev.lngLat.lng, ev.lngLat.lat] : route.waypoints[idx];
			route.moveWaypoint(idx, p);
		};

		map.on('mousemove', onMove as (ev: maplibregl.MapMouseEvent) => void);
		map.on('touchmove', onMove as (ev: maplibregl.MapTouchEvent) => void);
		map.once('mouseup', onUp as (ev: maplibregl.MapMouseEvent) => void);
		map.once('touchend', onUp as (ev: maplibregl.MapTouchEvent) => void);
		// Fallback if the pointer is released outside the canvas
		window.addEventListener('mouseup', () => onUp(), { once: true });
	}

	onMount(() => {
		currentStyle = styleUrl();
		const view = savedView();
		map = new maplibregl.Map({
			container,
			style: currentStyle,
			center: view?.center ?? [5.3, 52.15], // default: Netherlands
			zoom: view?.zoom ?? 7.2,
			doubleClickZoom: false, // avoid accidental double waypoints
			attributionControl: { compact: true }
		});
		map.addControl(
			new maplibregl.GeolocateControl({
				positionOptions: { enableHighAccuracy: true },
				showUserLocation: true
			}),
			'top-right'
		);
		map.on('style.load', () => {
			ready = false;
			addLayers();
		});
		// Safety net: if layers ever get wiped (e.g. style diff), re-add them
		map.on('styledata', () => {
			if (map?.isStyleLoaded() && !map.getSource('route')) {
				ready = false;
				addLayers();
			}
		});
		map.on('click', (e) => {
			if (suppressNextClick) {
				suppressNextClick = false;
				return;
			}
			route.addPoint([e.lngLat.lng, e.lngLat.lat]);
		});
		map.on('mousedown', 'waypoints-hit', startDrag);
		map.on('touchstart', 'waypoints-hit', startDrag);
		map.on('mouseenter', 'waypoints-hit', () => {
			if (!dragging && map) map.getCanvas().style.cursor = 'grab';
		});
		map.on('mouseleave', 'waypoints-hit', () => {
			if (!dragging && map) map.getCanvas().style.cursor = '';
		});
		// Remember map position for next visit
		map.on('moveend', () => {
			if (!map) return;
			try {
				localStorage.setItem(
					VIEW_KEY,
					JSON.stringify({ center: map.getCenter().toArray(), zoom: map.getZoom() })
				);
			} catch {
				/* ignore */
			}
		});
		return () => {
			map?.remove();
			map = null;
		};
	});

	// Follow the theme toggle
	$effect(() => {
		const desired = styleUrl();
		if (!map || !ready || desired === currentStyle) return;
		currentStyle = desired;
		// diff:false forces a full style reload so 'style.load' fires and our
		// route layers get re-added (a diffed swap would silently drop them)
		map.setStyle(desired, { diff: false });
	});

	// Keep route sources in sync
	$effect(() => {
		if (!map || !ready) return;
		const geo = route.geometry;
		(map.getSource('route') as maplibregl.GeoJSONSource | undefined)?.setData(lineFC(geo));
		(map.getSource('waypoints') as maplibregl.GeoJSONSource | undefined)?.setData(
			pointsFC(route.waypoints)
		);
		(map.getSource('splits') as maplibregl.GeoJSONSource | undefined)?.setData(
			splitsFC(geo, route.distanceKm)
		);
	});

	// Elevation scrubber marker on the map
	$effect(() => {
		if (!map || !ready) return;
		const km = scrub.km;
		const geo = route.geometry;
		(map.getSource('scrub') as maplibregl.GeoJSONSource | undefined)?.setData(
			km != null && geo.length > 1 ? pointsFC([pointAt(geo, km)]) : fc([])
		);
	});

	// Fit map to route ONLY when requested (loaded/shared routes) —
	// geometry changes (new waypoints) must never move the camera
	$effect(() => {
		route.fitRequest; // track
		if (!map) return;
		untrack(() => {
			if (!map || !ready || route.geometry.length < 2) return;
			const bounds = new maplibregl.LngLatBounds();
			for (const c of route.geometry) bounds.extend(c);
			map.fitBounds(bounds, {
				padding: { top: 60, bottom: 140, left: 60, right: 60 },
				maxZoom: 15,
				duration: 700
			});
		});
	});
</script>

<div bind:this={container} class="map"></div>

<style>
	.map {
		position: fixed;
		inset: 0;
	}
	:global(.maplibregl-canvas) {
		cursor: crosshair;
	}
</style>
