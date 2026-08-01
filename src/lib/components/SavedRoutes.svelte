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
			<li class="row">
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
		margin: 6px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	li.row {
		display: flex;
		align-items: center;
		gap: 2px;
		border: 1px solid var(--border);
		background: var(--fill);
		border-radius: 12px;
		padding-right: 4px;
		transition: background 0.15s;
	}

	li.row:hover {
		background: var(--fill-hover);
	}

	.item {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-align: left;
		padding: 8px 4px 8px 12px;
		border: 0;
		border-radius: 10px;
		background: transparent;
		cursor: pointer;
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
		width: 26px;
		height: 26px;
		flex: none;
		display: grid;
		place-items: center;
		padding: 0;
		margin-right: 4px;
		font-size: 10.5px;
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
		background: var(--panel-solid);
	}
</style>
