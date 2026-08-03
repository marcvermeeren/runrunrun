<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { route } from '$lib/stores/route.svelte';
	import { theme } from '$lib/stores/theme.svelte';
	import ElevationChart from './ElevationChart.svelte';
	import PaceCalc from './PaceCalc.svelte';
	import SavedRoutes from './SavedRoutes.svelte';
	import { sampleElevations, elevationStats, type ElevSample } from '$lib/api/elevation';
	import { loadRoutes, saveRoute, deleteRoute, type SavedRoute } from '$lib/api/storage';
	import { buildShareHash } from '$lib/api/share';
	import { toGpx } from '$lib/api/gpx';
	import { parseTime, fmtTime } from '$lib/pace';

	type Pop = 'pace' | 'saved' | 'elev' | 'save';

	let popover = $state<Pop | null>(null);
	let samples = $state<ElevSample[] | null>(null);
	let elevPending = $state(false);
	let saved = $state<SavedRoute[]>([]);
	let saveName = $state('');
	let paceStr = $state('5:30');
	let timeStr = $state('');

	onMount(() => {
		saved = loadRoutes();
	});

	// Debounced elevation sampling whenever the route geometry changes
	let fetchId = 0;
	$effect(() => {
		const geo = route.geometry;
		const dist = route.distanceKm;
		if (geo.length < 2 || dist <= 0) {
			samples = null;
			elevPending = false;
			return;
		}
		elevPending = true;
		const id = ++fetchId;
		const t = setTimeout(async () => {
			const res = await sampleElevations(geo, dist);
			if (id === fetchId) {
				samples = res;
				elevPending = false;
			}
		}, 450);
		return () => clearTimeout(t);
	});

	// Keep total time in sync with the route distance live (bar readout),
	// even while the pace popover is closed
	$effect(() => {
		const dist = route.distanceKm;
		const p = untrack(() => parseTime(paceStr));
		timeStr = p && dist > 0 ? fmtTime(p * dist) : '';
	});

	const distLabel = $derived(
		route.distanceKm < 1
			? { n: String(Math.round(route.distanceKm * 1000)), u: 'm' }
			: { n: route.distanceKm.toFixed(2), u: 'km' }
	);

	/** Tiny inline elevation sparkline for the bar */
	const spark = $derived.by(() => {
		if (!samples || samples.length < 2) return null;
		const stats = elevationStats(samples);
		const W = 84;
		const H = 22;
		const P = 1;
		const range = Math.max(1, stats.max - stats.min);
		const dMax = samples[samples.length - 1].d || 1;
		const pts = samples.map((s) => [
			P + (s.d / dMax) * (W - 2 * P),
			H - P - ((s.e - stats.min) / range) * (H - 2 * P)
		]);
		const line = 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L');
		return { line, area: `${line} L ${W - P} ${H - P} L ${P} ${H - P} Z`, stats };
	});

	function togglePop(p: Pop) {
		popover = popover === p ? null : p;
	}

	function doSave() {
		const name = saveName.trim() || `Run ${new Date().toLocaleDateString()}`;
		saveRoute({
			id: crypto.randomUUID(),
			name,
			createdAt: Date.now(),
			distanceKm: route.distanceKm,
			waypoints: route.waypoints,
			legs: route.legs,
			closed: route.closed,
			mirrored: route.mirrored
		});
		saved = loadRoutes();
		saveName = '';
		popover = 'saved';
		route.flash('Route saved');
	}

	function doLoad(r: SavedRoute) {
		if (route.distanceKm > 0 && !confirm(`Load “${r.name}” and replace the current route?`))
			return;
		route.loadSaved(r);
		popover = null;
	}

	function doDelete(id: string) {
		deleteRoute(id);
		saved = loadRoutes();
	}

	async function doShare() {
		const url = `${location.origin}${location.pathname}${buildShareHash(route.waypoints, route.closed, route.mirrored)}`;
		try {
			await navigator.clipboard.writeText(url);
			route.flash('Share link copied');
		} catch {
			route.flash('Could not copy link');
		}
	}

	function doExport() {
		const km = route.distanceKm;
		const gpx = toGpx(`runrunrun ${km.toFixed(2)} km`, route.geometry, samples);
		const url = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = `runrunrun-${km.toFixed(1)}km.gpx`;
		a.click();
		URL.revokeObjectURL(url);
		route.flash('GPX downloaded');
	}
</script>

{#if route.notice}
	<div class="toast">{route.notice}</div>
{/if}

<div class="logo">runrunrun</div>

<div class="dock">
	{#if popover}
		<div class="popover">
			<button class="close" onclick={() => (popover = null)} aria-label="Close">✕</button>
			{#if popover === 'pace'}
				<PaceCalc distanceKm={route.distanceKm} bind:paceStr bind:timeStr />
			{:else if popover === 'elev'}
				<ElevationChart {samples} loading={elevPending} />
			{:else if popover === 'saved'}
				<SavedRoutes routes={saved} onload={doLoad} ondelete={doDelete} />
			{:else if popover === 'save'}
				<form
					class="savebar"
					onsubmit={(e) => {
						e.preventDefault();
						doSave();
					}}
				>
					<!-- svelte-ignore a11y_autofocus -->
					<input bind:value={saveName} placeholder="Route name" autofocus />
					<button type="submit" class="primary">Save</button>
				</form>
			{/if}
		</div>
	{/if}

	<div class="bar">
		<div class="id">
			<div class="distline">
				<span class="distance">{distLabel.n}</span><span class="unit">{distLabel.u}</span>
			</div>
			{#if route.waypoints.length}
				<div class="sub">
					{route.waypoints.length}
					{route.waypoints.length === 1 ? 'pt' : 'pts'}{#if route.closed}
						· loop{/if}{#if route.busy}
						· <span class="pulse">routing…</span>{/if}
				</div>
			{/if}
		</div>

		{#if route.distanceKm > 0}
			<div class="divider"></div>

			{#if spark}
				<button
					class="cluster"
					class:active={popover === 'elev'}
					onclick={() => togglePop('elev')}
					title="Elevation profile"
				>
					<svg viewBox="0 0 84 22" class="spark" preserveAspectRatio="none">
						<defs>
							<linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0" stop-color="var(--accent)" stop-opacity="0.3" />
								<stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
							</linearGradient>
						</defs>
						<path d={spark.area} fill="url(#sg)" />
						<path
							d={spark.line}
							fill="none"
							stroke="var(--accent)"
							stroke-width="1.25"
							vector-effect="non-scaling-stroke"
							stroke-linejoin="round"
							stroke-linecap="round"
						/>
					</svg>
					<span class="micro"
						>↑{Math.round(spark.stats.ascent)} ↓{Math.round(spark.stats.descent)} m</span
					>
				</button>
			{/if}

			<button
				class="cluster"
				class:active={popover === 'pace'}
				onclick={() => togglePop('pace')}
				title="Pace & time"
			>
				<span class="val">{paceStr}<span class="dim"> /km</span></span>
				<span class="micro">{timeStr || '–'} total</span>
			</button>
		{/if}

		<div class="divider"></div>

		<div class="actions">
			<button
				class="icon"
				onclick={route.undo}
				disabled={!route.canUndo || route.busy}
				title="Undo (⌘Z)"
				aria-label="Undo"
			>
				<svg
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="1 4 1 10 7 10" />
					<path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
				</svg>
			</button>
			<button
				class="icon"
				onclick={route.redo}
				disabled={!route.canRedo || route.busy}
				title="Redo (⌘⇧Z)"
				aria-label="Redo"
			>
				<svg
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="23 4 23 10 17 10" />
					<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
				</svg>
			</button>
			<button
				class="icon"
				onclick={route.closeLoop}
				disabled={!route.canLoop || route.busy}
				title="Close loop back to start"
				aria-label="Close loop"
			>
				<svg
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="17 1 21 5 17 9" />
					<path d="M3 11V9a4 4 0 0 1 4-4h14" />
					<polyline points="7 23 3 19 7 15" />
					<path d="M21 13v2a4 4 0 0 1-4 4H3" />
				</svg>
			</button>
			<button
				class="icon"
				onclick={route.outAndBack}
				disabled={!route.canOutAndBack || route.busy}
				title="Out and back — mirror route back to start"
				aria-label="Out and back"
			>
				<svg
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M4 7h13" />
					<polyline points="13 3 17 7 13 11" />
					<path d="M20 17H7" />
					<polyline points="11 21 7 17 11 13" />
				</svg>
			</button>
			<button
				class="icon"
				onclick={route.clear}
				disabled={route.waypoints.length === 0 || route.busy}
				title="Clear route"
				aria-label="Clear route"
			>
				<svg
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="3 6 5 6 21 6" />
					<path
						d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
					/>
				</svg>
			</button>
		</div>

		<button
			class="save"
			onclick={() => togglePop('save')}
			disabled={route.distanceKm === 0 || route.busy}>Save</button
		>

		<button
			class="icon"
			onclick={doShare}
			disabled={route.distanceKm === 0 || route.busy}
			title="Copy share link"
			aria-label="Copy share link"
		>
			<svg
				width="15"
				height="15"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="17 8 12 3 7 8" />
				<line x1="12" y1="3" x2="12" y2="15" />
			</svg>
		</button>

		<button
			class="icon"
			onclick={doExport}
			disabled={route.distanceKm === 0 || route.busy}
			title="Export as GPX (Garmin, Strava, watches)"
			aria-label="Export as GPX"
		>
			<svg
				width="15"
				height="15"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="7 10 12 15 17 10" />
				<line x1="12" y1="15" x2="12" y2="3" />
			</svg>
		</button>

		<div class="divider"></div>

		<button
			class="icon lib"
			class:active={popover === 'saved'}
			onclick={() => togglePop('saved')}
			title="Saved routes"
			aria-label="Saved routes"
		>
			<svg
				width="15"
				height="15"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path
					d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
				/>
			</svg>
			{#if saved.length}
				<span class="badge">{saved.length}</span>
			{/if}
		</button>

		<button
			class="icon"
			onclick={theme.toggle}
			title={theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
			aria-label="Toggle color theme"
		>
			{#if theme.isDark}
				<svg
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				>
					<circle cx="12" cy="12" r="4" />
					<path
						d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
					/>
				</svg>
			{:else}
				<svg
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
				</svg>
			{/if}
		</button>
	</div>
</div>

<style>
	.dock {
		position: fixed;
		bottom: 14px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		z-index: 10;
		max-width: calc(100vw - 20px);
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 10px;
		max-width: 100%;
		padding: 8px 14px;
		background: var(--panel);
		backdrop-filter: blur(24px) saturate(1.8);
		-webkit-backdrop-filter: blur(24px) saturate(1.8);
		border: 1px solid var(--border);
		border-radius: 16px;
		box-shadow: var(--shadow);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.bar::-webkit-scrollbar {
		display: none;
	}

	.id {
		display: flex;
		flex-direction: column;
		white-space: nowrap;
	}

	.distline {
		display: flex;
		align-items: baseline;
		gap: 3px;
	}

	.distance {
		font-size: 22px;
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.05;
		font-variant-numeric: tabular-nums;
	}

	.unit {
		font-size: 12px;
		font-weight: 600;
		color: var(--text2);
	}

	.sub {
		font-size: 10.5px;
		color: var(--text2);
		white-space: nowrap;
	}

	.pulse {
		animation: pulse 1.2s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			opacity: 0.4;
		}
	}

	.divider {
		width: 1px;
		height: 26px;
		flex: none;
		background: var(--border);
	}

	.cluster {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1px;
		padding: 4px 8px;
		border: 0;
		border-radius: 9px;
		background: transparent;
		cursor: pointer;
		white-space: nowrap;
		transition: background 0.15s;
		flex: none;
	}

	.cluster:hover,
	.cluster.active {
		background: var(--fill);
	}

	.cluster .val {
		font-size: 14px;
		font-weight: 650;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}

	.cluster .dim {
		font-size: 10.5px;
		font-weight: 500;
		color: var(--text2);
	}

	.micro {
		font-size: 10px;
		color: var(--text2);
		font-variant-numeric: tabular-nums;
	}

	.spark {
		display: block;
		width: 84px;
		height: 22px;
	}

	.actions {
		display: flex;
		gap: 2px;
	}

	.icon {
		position: relative;
		width: 30px;
		height: 30px;
		flex: none;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--text2);
		cursor: pointer;
		transition:
			color 0.15s,
			background 0.15s,
			transform 0.08s,
			opacity 0.15s;
	}

	.icon:hover:not(:disabled) {
		color: var(--text);
		background: var(--fill);
	}

	.icon.active {
		color: var(--accent);
		background: var(--fill);
	}

	.icon:active:not(:disabled) {
		transform: scale(0.9);
	}

	.icon:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.save {
		padding: 6px 14px;
		font-size: 12.5px;
		font-weight: 600;
		border: 0;
		border-radius: 9px;
		background: var(--accent);
		color: #fff;
		cursor: pointer;
		flex: none;
		transition:
			filter 0.15s,
			transform 0.08s,
			opacity 0.15s;
	}

	.save:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.save:active:not(:disabled) {
		transform: scale(0.96);
	}

	.save:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.badge {
		position: absolute;
		top: -4px;
		right: -4px;
		min-width: 14px;
		height: 14px;
		padding: 0 3px;
		border-radius: 999px;
		background: var(--accent);
		color: #fff;
		font-size: 9px;
		font-weight: 700;
		display: grid;
		place-items: center;
	}

	.popover {
		position: relative;
		width: 340px;
		max-width: 100%;
		background: var(--panel);
		backdrop-filter: blur(24px) saturate(1.8);
		-webkit-backdrop-filter: blur(24px) saturate(1.8);
		border: 1px solid var(--border);
		border-radius: 14px;
		box-shadow: var(--shadow);
		padding: 14px;
		animation: rise 0.18s ease-out;
	}

	.popover .close {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 22px;
		height: 22px;
		border: 0;
		border-radius: 50%;
		background: var(--fill);
		color: var(--text2);
		font-size: 10px;
		cursor: pointer;
		display: grid;
		place-items: center;
		transition:
			background 0.15s,
			color 0.15s;
	}

	.popover .close:hover {
		background: var(--fill-hover);
		color: var(--text);
	}

	.popover :global(.card) {
		margin-top: 0;
		padding: 0;
		background: transparent;
	}

	.popover :global(ul) {
		max-height: 220px;
		overflow-y: auto;
	}

	.popover :global(.hint) {
		margin: 0;
	}

	.savebar {
		display: flex;
		gap: 6px;
	}

	.savebar input {
		flex: 1;
		min-width: 0;
		padding: 7px 10px;
		font-size: 13px;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--panel-solid);
		outline: none;
	}

	.savebar input:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent);
	}

	.savebar button {
		padding: 7px 12px;
		font-size: 13px;
		border-radius: 10px;
		border: 0;
		background: var(--accent);
		color: #fff;
		cursor: pointer;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}

	.logo {
		position: fixed;
		top: 14px;
		left: 50%;
		transform: translateX(-50%);
		font-family: 'Alan Sans', -apple-system, BlinkMacSystemFont, sans-serif;
		font-weight: 700;
		font-size: 15px;
		letter-spacing: -0.01em;
		color: var(--text);
		background: var(--panel);
		backdrop-filter: blur(24px) saturate(1.8);
		-webkit-backdrop-filter: blur(24px) saturate(1.8);
		border: 1px solid var(--border);
		border-radius: 999px;
		box-shadow: var(--shadow);
		padding: 6px 15px 7px;
		z-index: 10;
		user-select: none;
	}

	.toast {
		position: fixed;
		top: 60px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(40, 40, 42, 0.85);
		color: #fff;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		padding: 8px 16px;
		border-radius: 999px;
		font-size: 13px;
		z-index: 100;
		box-shadow: var(--shadow);
		animation: pop 0.18s ease-out;
		white-space: nowrap;
	}

	@keyframes pop {
		from {
			opacity: 0;
			transform: translate(-50%, -6px);
		}
	}

	@media (max-width: 700px) {
		.dock {
			left: 10px;
			right: 10px;
			bottom: 10px;
			transform: none;
			max-width: none;
		}

		.popover {
			width: 100%;
		}
	}
</style>
