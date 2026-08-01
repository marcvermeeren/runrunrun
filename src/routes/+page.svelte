<script lang="ts">
	import { onMount } from 'svelte';
	import Map from '$lib/components/Map.svelte';
	import RoutePanel from '$lib/components/RoutePanel.svelte';
	import { route } from '$lib/stores/route.svelte';
	import { parseShareHash } from '$lib/api/share';

	onMount(() => {
		const shared = parseShareHash(window.location.hash);
		if (!shared) return;
		history.replaceState(null, '', window.location.pathname + window.location.search);
		route.loadShared(shared.waypoints, shared.closed, shared.mirrored);
	});

	function onkeydown(e: KeyboardEvent) {
		if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
		const tag = (e.target as HTMLElement)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA') return;
		e.preventDefault();
		if (e.shiftKey) route.redo();
		else route.undo();
	}
</script>

<svelte:window {onkeydown} />

<Map />
<RoutePanel />
