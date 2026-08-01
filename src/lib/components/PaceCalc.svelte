<script lang="ts">
	import { untrack } from 'svelte';

	let {
		distanceKm,
		paceStr = $bindable('5:30'),
		timeStr = $bindable('')
	}: { distanceKm: number; paceStr?: string; timeStr?: string } = $props();

	/** Parse "m:ss" / "h:mm:ss" / plain minutes into seconds */
	function parseTime(s: string): number | null {
		const parts = s.trim().split(':').map(Number);
		if (parts.some((p) => Number.isNaN(p) || p < 0) || parts.length > 3 || !s.trim())
			return null;
		let sec = 0;
		for (const p of parts) sec = sec * 60 + p;
		return sec > 0 ? sec : null;
	}

	function fmt(sec: number): string {
		sec = Math.round(sec);
		const h = Math.floor(sec / 3600);
		const m = Math.floor((sec % 3600) / 60);
		const s = sec % 60;
		return h
			? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
			: `${m}:${String(s).padStart(2, '0')}`;
	}

	function onPaceInput() {
		const p = parseTime(paceStr);
		if (p && distanceKm > 0) timeStr = fmt(p * distanceKm);
	}

	function onTimeInput() {
		const t = parseTime(timeStr);
		if (t && distanceKm > 0) paceStr = fmt(t / distanceKm);
	}

	// Keep total time in sync as the route distance changes (without clobbering edits)
	$effect(() => {
		const dist = distanceKm;
		const p = untrack(() => parseTime(paceStr));
		timeStr = p && dist > 0 ? fmt(p * dist) : '';
	});
</script>

<div class="card">
	<div class="card-title">Pace &amp; time</div>
	<div class="row">
		<label>
			<span>Pace <span class="dim">/km</span></span>
			<input
				bind:value={paceStr}
				oninput={onPaceInput}
				placeholder="5:30"
				inputmode="numeric"
				disabled={distanceKm <= 0}
			/>
		</label>
		<label>
			<span>Total time</span>
			<input
				bind:value={timeStr}
				oninput={onTimeInput}
				placeholder="0:55"
				inputmode="numeric"
				disabled={distanceKm <= 0}
			/>
		</label>
	</div>
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
		margin-bottom: 10px;
	}

	.row {
		display: flex;
		gap: 10px;
	}

	label {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 5px;
		font-size: 12.5px;
		font-weight: 500;
	}

	.dim {
		color: var(--text2);
		font-weight: 400;
	}

	input {
		width: 100%;
		padding: 8px 10px;
		font-size: 15px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--panel-solid);
		outline: none;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}

	input:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent);
	}

	input:disabled {
		opacity: 0.4;
	}
</style>
