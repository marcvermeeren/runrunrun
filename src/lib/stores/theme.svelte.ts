type Theme = 'light' | 'dark';

const THEME_KEY = 'runrunrun:theme';

function createThemeStore() {
	const hasWindow = typeof window !== 'undefined';
	const mq = hasWindow ? window.matchMedia('(prefers-color-scheme: dark)') : null;

	/** Manual override — null means "follow system" */
	let override = $state<Theme | null>(
		hasWindow ? ((localStorage.getItem(THEME_KEY) as Theme | null) ?? null) : null
	);
	let system = $state<Theme>(mq?.matches ? 'dark' : 'light');

	const resolved = $derived<Theme>(override ?? system);

	mq?.addEventListener('change', (e) => {
		system = e.matches ? 'dark' : 'light';
	});

	function toggle() {
		override = resolved === 'dark' ? 'light' : 'dark';
		localStorage.setItem(THEME_KEY, override);
	}

	return {
		get resolved() {
			return resolved;
		},
		get isDark() {
			return resolved === 'dark';
		},
		toggle
	};
}

export const theme = createThemeStore();
