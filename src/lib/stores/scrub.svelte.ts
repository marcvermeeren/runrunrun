/** Shared hover position (km along route) between the elevation chart and the map */
function createScrub() {
	let km = $state<number | null>(null);
	return {
		get km() {
			return km;
		},
		set(v: number | null) {
			km = v;
		}
	};
}

export const scrub = createScrub();
