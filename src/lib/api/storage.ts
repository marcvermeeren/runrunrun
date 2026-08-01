import { STORAGE_KEY } from '$lib/config';
import type { LngLat } from '$lib/geo';

export interface SavedRoute {
	id: string;
	name: string;
	createdAt: number;
	distanceKm: number;
	waypoints: LngLat[];
	legs: LngLat[][];
	closed: boolean;
	mirrored?: boolean;
}

export function loadRoutes(): SavedRoute[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as SavedRoute[]) : [];
	} catch {
		return [];
	}
}

export function saveRoute(route: SavedRoute): void {
	const all = loadRoutes();
	all.unshift(route);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteRoute(id: string): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(loadRoutes().filter((r) => r.id !== id)));
}
