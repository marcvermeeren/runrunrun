# runrunrun 🏃

A minimal, macOS-feel web app to plan running routes on a map and see the distance in km.

## Features

- **Click-to-draw routes** snapped to roads/paths (Valhalla pedestrian routing)
- **Live distance** in km with numbered split markers every kilometer
- **Elevation profile** from free Terrarium terrain tiles (ascent/descent)
- **Pace calculator** — enter pace ↔ total time
- **Loop mode** — one click closes the route back to the start
- **Undo/redo** (⌘Z / ⌘⇧Z), clear, straight-line fallback if routing fails
- **Save routes locally** (localStorage) and reload them later
- Frosted-glass, Apple-style UI with automatic light/dark mode
- Mobile-friendly bottom-sheet layout, geolocate button

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
