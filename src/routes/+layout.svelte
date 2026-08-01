<script lang="ts">
	import '../app.css';
	import { theme } from '$lib/stores/theme.svelte';

	let { children } = $props();

	$effect(() => {
		document.documentElement.dataset.theme = theme.resolved;
	});
</script>

{@render children()}
