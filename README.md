# runrunrun 🏃

A minimal web app to plan running routes.

## Features

- **Click-to-draw routes** snapped to roads/paths (Valhalla pedestrian routing)
- **Live distance** in km with numbered split markers every kilometer
- **Drag waypoints** to adjust the route — segments re-snap on drop
- **Elevation profile** with a hover scrubber that tracks your position on the map
- **Pace calculator** — enter pace ↔ total time
- **Loop & out-and-back modes** — close the route or mirror it back in one click
- **GPX export** with elevation — straight to your watch or Strava
- **Share links** — routes encoded in the URL, no backend needed
- **Undo/redo** (⌘Z / ⌘⇧Z), clear, straight-line fallback if routing fails
- **Save routes locally** (localStorage) and reload them later
- Light/dark mode toggle, remembers your map position

## Stack

SvelteKit (static) · MapLibre GL + OpenFreeMap tiles · Valhalla public API · Terrarium elevation tiles (AWS Open Data) — **no API keys anywhere**.

## Develop

```bash
npm install
npm run dev
```

## Build / deploy

```bash
npm run build   # static output in build/ — ready for Cloudflare Pages
```
