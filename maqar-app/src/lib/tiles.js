// CARTO basemap tiles — the single definition for every map in the app.
//
// This lived in two places: MapView got the API key and HostListRoom's location picker
// did not, so the host's map kept the "API KEY REQUIRED" watermark long after the browse
// map was fixed. One module means the next key change cannot miss a map.
//
// CARTO began watermarking keyless tiles around August 2026. The parameter is `key`, not
// `api_key`, and keyed access uses the /rastertiles/ path. `{r}` is Leaflet's retina
// placeholder — it resolves to "@2x" on high-DPI screens, which CARTO serves.
//
// Careful: a WRONG key does not error. CARTO returns HTTP 200 with the same watermarked
// tile as no key at all, so the only way to tell a key works is to look at the map.
const CARTO_KEY = import.meta.env.VITE_CARTO_KEY;
const KEY_Q = CARTO_KEY ? `?key=${CARTO_KEY}` : "";

export const TILES = {
  light: `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png${KEY_Q}`,
  dark: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png${KEY_Q}`,
};

// CARTO and OpenStreetMap must stay credited on every map — it is a condition of the
// free tier, not decoration.
export const TILE_ATTRIB =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
