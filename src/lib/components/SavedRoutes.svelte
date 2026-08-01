<script lang="ts">
	import type { SavedRoute } from '$lib/api/storage';

	let {
		routes,
		onload,
		ondelete
	}: {
		routes: SavedRoute[];
		onload: (r: SavedRoute) => void;
		ondelete: (id: string) => void;
	} = $props();

	const fmtDate = (t: number) =>
		new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
</script>

{#if routes.length === 0}
	<p class="hint">No saved routes yet. Draw a route and hit Save — it's stored locally in your browser.</p>
{:else}
	<div class="card-title">Saved routes</div>
	<ul>
		{#each routes as r (r.id)}
			<li>
				<button class="item" onclick={() => onload(r)}>
					<span class="name">{r.name}</span>
					<span class="meta">{r.distanceKm.toFixed(2)} km · {fmtDate(r.createdAt)}</span>
				</button>
				<button class="del" aria-label="Delete {r.name}" onclick={() => ondelete(r.id)}>
					✕
				</button>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.hint {
		font-size: 13.5px;
		line-height: 1.55;
		color: var(--text2);
		margin: 12px 2px 2px;
	}

	.card-title {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text2);
		margin-bottom: 8px;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	li {
		display: flex;
		gap: 6px;
		align-items: center;
	}

	.item {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-align: left;
		padding: 9px 12px;
		border-radius: 12px;
		border: 1px solid var(--border);
		background: var(--fill);
		cursor: pointer;
		transition:
			background 0.15s,
			transform 0.08s;
	}

	.item:hover {
		background: var(--fill-hover);
	}

	.item:active {
		transform: scale(0.98);
	}

	.name {
		font-size: 13.5px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.meta {
		font-size: 12px;
		color: var(--text2);
		font-variant-numeric: tabular-nums;
	}

	.del {
		width: 28px;
		height: 28px;
		flex: none;
		display: grid;
		place-items: center;
		padding: 0;
		font-size: 11px;
		border-radius: 8px;
		border: 0;
		background: transparent;
		color: var(--text2);
		cursor: pointer;
		transition:
			color 0.15s,
			background 0.15s;
	}

	.del:hover {
		color: #ff3b30;
		background: var(--fill);
	}
</style>
