<script lang="ts">
	import { onDestroy } from 'svelte';
	import { elevationStats, type ElevSample } from '$lib/api/elevation';
	import { scrub } from '$lib/stores/scrub.svelte';

	let { samples, loading }: { samples: ElevSample[] | null; loading: boolean } = $props();

	const W = 300;
	const H = 90;
	const P = 6;

	const chart = $derived.by(() => {
		if (!samples || samples.length < 2) return null;
		const stats = elevationStats(samples);
		const range = Math.max(1, stats.max - stats.min);
		const dMax = samples[samples.length - 1].d || 1;
		const pts = samples.map((s) => [
			P + (s.d / dMax) * (W - 2 * P),
			H - P - ((s.e - stats.min) / range) * (H - 2 * P - 10)
		]);
		const line = 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L');
		const area = `${line} L ${(W - P).toFixed(1)} ${H - P} L ${P} ${H - P} Z`;
		return { line, area, stats };
	});

	/** Hover position synced with the map marker via the scrub store */
	const hover = $derived.by(() => {
		const km = scrub.km;
		if (!chart || !samples || samples.length < 2 || km == null) return null;
		const dMax = samples[samples.length - 1].d || 1;
		const target = Math.min(km, dMax);
		let best = samples[0];
		for (const s of samples) if (Math.abs(s.d - target) < Math.abs(best.d - target)) best = s;
		const range = Math.max(1, chart.stats.max - chart.stats.min);
		return {
			x: P + (best.d / dMax) * (W - 2 * P),
			y: H - P - ((best.e - chart.stats.min) / range) * (H - 2 * P - 10),
			d: best.d,
			e: best.e
		};
	});

	function onpointermove(e: PointerEvent) {
		if (!chart || !samples || samples.length < 2) return;
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
		scrub.set(frac * (samples[samples.length - 1].d || 1));
	}

	onDestroy(() => scrub.set(null));
</script>

<div class="card">
	<div class="card-title">Elevation</div>
	{#if chart}
		<svg
			viewBox="0 0 {W} {H}"
			preserveAspectRatio="none"
			class="chart"
			role="img"
			aria-label="Elevation profile — hover to inspect a point on the route"
			{onpointermove}
			onpointerleave={() => scrub.set(null)}
		>
			<defs>
				<linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stop-color="var(--accent)" stop-opacity="0.35" />
					<stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
				</linearGradient>
			</defs>
			<path d={chart.area} fill="url(#eg)" />
			<path
				d={chart.line}
				fill="none"
				stroke="var(--accent)"
				stroke-width="1.5"
				vector-effect="non-scaling-stroke"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
			{#if hover}
				<line x1={hover.x} y1={P} x2={hover.x} y2={H - P} class="hoverline" />
				<circle cx={hover.x} cy={hover.y} r="3.2" class="hoverdot" />
				<text
					x={Math.min(Math.max(hover.x, 36), W - 36)}
					y={P + 9}
					text-anchor="middle"
					class="hoverlabel"
				>
					{hover.d.toFixed(1)} km · {Math.round(hover.e)} m
				</text>
			{/if}
		</svg>
		<div class="elevstats">
			<span>↑ {Math.round(chart.stats.ascent)} m</span>
			<span>↓ {Math.round(chart.stats.descent)} m</span>
			<span class="dim">{Math.round(chart.stats.min)}–{Math.round(chart.stats.max)} m</span>
		</div>
	{:else}
		<div class="placeholder">{loading ? 'Loading elevation…' : 'Elevation unavailable'}</div>
	{/if}
</div>

<style>
	.card {
		margin-top: 12px;
		background: var(--fill);
		border-radius: 14px;
		padding: 12px;
	}

	.card-title {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text2);
		margin-bottom: 8px;
	}

	.chart {
		display: block;
		width: 100%;
		height: 90px;
		cursor: crosshair;
		touch-action: pan-y;
	}

	.hoverline {
		stroke: var(--text2);
		stroke-width: 0.75;
		stroke-dasharray: 2.5 2.5;
		vector-effect: non-scaling-stroke;
	}

	.hoverdot {
		fill: var(--accent);
		stroke: var(--panel-solid);
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
	}

	.hoverlabel {
		font-size: 9.5px;
		font-weight: 600;
		fill: var(--text);
		font-family: inherit;
	}

	.elevstats {
		display: flex;
		gap: 14px;
		margin-top: 8px;
		font-size: 12.5px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	.dim {
		color: var(--text2);
		font-weight: 400;
		margin-left: auto;
	}

	.placeholder {
		height: 90px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12.5px;
		color: var(--text2);
	}
</style>
