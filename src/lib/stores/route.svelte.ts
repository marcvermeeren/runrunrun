import { routeSegment } from '$lib/api/valhalla';
import { pathLengthKm, type LngLat } from '$lib/geo';
import type { SavedRoute } from '$lib/api/storage';

interface Snapshot {
	waypoints: LngLat[];
	legs: LngLat[][];
	closed: boolean;
	mirrored: boolean;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function createRoute() {
	let waypoints = $state<LngLat[]>([]);
	let legs = $state<LngLat[][]>([]);
	let closed = $state(false);
	let mirrored = $state(false); // out-and-back: route mirrored back along itself
	let past = $state<Snapshot[]>([]);
	let future = $state<Snapshot[]>([]);
	let busy = $state(false);
	let notice = $state('');
	let fitRequest = $state(0);
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;

	/** Full route line: all snapped legs joined together */
	const geometry = $derived<LngLat[]>(
		legs.map((l, i) => (i === 0 ? l : l.slice(1))).flat()
	);
	const distanceKm = $derived(pathLengthKm(geometry));

	function flash(msg: string) {
		notice = msg;
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = ''), 2600);
	}

	function snap(): Snapshot {
		return clone({ waypoints, legs, closed, mirrored });
	}

	function pushHistory() {
		past.push(snap());
		future = [];
	}

	function apply(s: Snapshot) {
		const c = clone(s);
		waypoints = c.waypoints;
		legs = c.legs;
		closed = c.closed;
		mirrored = c.mirrored;
	}

	/** Route `from → to` via Valhalla; falls back to a straight line on failure */
	async function appendLeg(from: LngLat, to: LngLat) {
		try {
			const seg = await routeSegment(from, to);
			legs.push(seg.path);
		} catch {
			legs.push([from, to]);
			flash('Routing failed — straight segment used');
		}
	}

	async function addPoint(p: LngLat) {
		if (busy) return;
		busy = true;
		pushHistory();
		if (waypoints.length === 0) {
			waypoints.push(p);
		} else {
			await appendLeg(waypoints[waypoints.length - 1], p);
			waypoints.push(p);
			closed = false;
			mirrored = false;
		}
		busy = false;
	}

	async function closeLoop() {
		if (busy || closed || waypoints.length < 3) return;
		busy = true;
		pushHistory();
		await appendLeg(waypoints[waypoints.length - 1], waypoints[0]);
		closed = true;
		busy = false;
	}

	/** Regenerate the mirrored return legs from the outbound legs */
	function rebuildMirror() {
		const orig = legs.slice(0, waypoints.length - 1);
		legs = [...orig, ...orig.slice().reverse().map((l) => l.slice().reverse())];
	}

	/** Out-and-back: mirror the route back along itself — no routing needed */
	function outAndBack() {
		if (busy || closed || waypoints.length < 2) return;
		pushHistory();
		rebuildMirror();
		closed = true;
		mirrored = true;
	}

	function undo() {
		const s = past.pop();
		if (!s) return;
		future.push(snap());
		apply(s);
	}

	function redo() {
		const s = future.pop();
		if (!s) return;
		past.push(snap());
		apply(s);
	}

	function clear() {
		if (!waypoints.length) return;
		pushHistory();
		waypoints = [];
		legs = [];
		closed = false;
		mirrored = false;
	}

	function loadSaved(r: SavedRoute) {
		pushHistory();
		waypoints = clone(r.waypoints);
		legs = clone(r.legs);
		closed = r.closed;
		mirrored = r.mirrored ?? false;
		requestFit();
		flash(`Loaded “${r.name}”`);
	}

	/** Live-preview a waypoint drag: straight lines, no history, no routing */
	function previewMove(i: number, p: LngLat) {
		const n = waypoints.length;
		if (i < 0 || i >= n) return;
		waypoints[i] = p;
		if (i > 0) legs[i - 1] = [waypoints[i - 1], p];
		if (i < n - 1) legs[i] = [p, waypoints[i + 1]];
		if (mirrored) rebuildMirror();
		else if (closed && n > 1) {
			if (i === n - 1) legs[n - 1] = [p, waypoints[0]];
			if (i === 0) legs[n - 1] = [waypoints[n - 1], p];
		}
	}

	/** Commit a waypoint drag: re-route the affected legs through the new position */
	async function moveWaypoint(i: number, p: LngLat) {
		const n = waypoints.length;
		if (busy || i < 0 || i >= n) return;
		busy = true;
		pushHistory();
		waypoints[i] = p;
		const reroute = async (legIdx: number, from: LngLat, to: LngLat) => {
			try {
				legs[legIdx] = (await routeSegment(from, to)).path;
			} catch {
				legs[legIdx] = [from, to];
				flash('Routing failed — straight segment used');
			}
		};
		const jobs: Promise<void>[] = [];
		if (i > 0) jobs.push(reroute(i - 1, waypoints[i - 1], p));
		if (i < n - 1) jobs.push(reroute(i, p, waypoints[i + 1]));
		if (!mirrored && closed && n > 1) {
			if (i === n - 1) jobs.push(reroute(n - 1, p, waypoints[0]));
			if (i === 0) jobs.push(reroute(n - 1, waypoints[n - 1], p));
		}
		await Promise.all(jobs);
		if (mirrored) rebuildMirror();
		busy = false;
	}

	/** Load a route from a share link: waypoints only, legs re-snapped via Valhalla */
	async function loadShared(wps: LngLat[], close: boolean, mirror: boolean) {
		if (busy || !wps.length) return;
		busy = true;
		pushHistory();
		waypoints = wps.map((p) => [...p] as LngLat);
		legs = [];
		closed = false;
		mirrored = false;
		for (let i = 1; i < wps.length; i++) await appendLeg(wps[i - 1], wps[i]);
		if (mirror && legs.length) {
			rebuildMirror();
			closed = true;
			mirrored = true;
		} else if (close && wps.length > 2) {
			await appendLeg(wps[wps.length - 1], wps[0]);
			closed = true;
		}
		busy = false;
		requestFit();
		flash('Route loaded from link');
	}

	function requestFit() {
		fitRequest++;
	}

	return {
		get waypoints() {
			return waypoints;
		},
		get legs() {
			return legs;
		},
		get closed() {
			return closed;
		},
		get mirrored() {
			return mirrored;
		},
		get busy() {
			return busy;
		},
		get notice() {
			return notice;
		},
		get geometry() {
			return geometry;
		},
		get distanceKm() {
			return distanceKm;
		},
		get canUndo() {
			return past.length > 0;
		},
		get canRedo() {
			return future.length > 0;
		},
		get canLoop() {
			return !closed && waypoints.length > 2;
		},
		get canOutAndBack() {
			return !closed && waypoints.length > 1;
		},
		get fitRequest() {
			return fitRequest;
		},
		addPoint,
		closeLoop,
		outAndBack,
		undo,
		redo,
		clear,
		loadSaved,
		loadShared,
		previewMove,
		moveWaypoint,
		requestFit,
		flash
	};
}

export const route = createRoute();
