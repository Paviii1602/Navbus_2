// Backend URL: set VITE_BACKEND_URL in .env for production
// e.g.  VITE_BACKEND_URL=https://navbus.onrender.com
const BACKEND = import.meta.env.VITE_BACKEND_URL || '';
const BASE    = `${BACKEND}/api`;

async function apiFetch(path, opts = {}) {
  const res  = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  // Check if response has content
  const text = await res.text();
  if (!text) {
    throw new Error('Empty response from server');
  }
  const data = JSON.parse(text);
  if (!res.ok) throw new Error(data.error || 'API Error');
  return data;
}

export const api = {
  login:   (u, p)      => apiFetch('/login',    { method: 'POST', body: JSON.stringify({ username: u, password: p }) }),
  register:(u, p, r)   => apiFetch('/register', { method: 'POST', body: JSON.stringify({ username: u, password: p, role: r }) }),
  getRoutes:            () => apiFetch('/routes'),
  getRoute:        (id) => apiFetch(`/routes/${id}`),
  getBuses:             () => apiFetch('/buses'),
  getBus:          (id) => apiFetch(`/buses/${id}`),
  getAllStops:           () => apiFetch('/stops/all'),
  searchStops: (f, t)   => apiFetch(`/stops/search?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`),
  updateBusLocation: (busId, lat, lng, speed, src) =>
    apiFetch(`/buses/${busId}/location`, { method: 'POST', body: JSON.stringify({ lat, lng, speed, source_type: src }) }),
  startTrip:  (dId, bId, rId) =>
    apiFetch('/driver/start-trip', { method: 'POST', body: JSON.stringify({ driver_id: dId, bus_id: bId, route_id: rId }) }),
  updateDriverLocation: (tId, lat, lng, speed) =>
    apiFetch('/driver/update-location', { method: 'POST', body: JSON.stringify({ trip_id: tId, lat, lng, speed }) }),
  endTrip: (tId) => apiFetch('/driver/end-trip', { method: 'POST', body: JSON.stringify({ trip_id: tId }) }),
};

export function getEtaLabel(etaData) {
  if (!etaData) return { label: 'Schedule only', cls: 'eta-grey' };
  const { status, eta_minutes } = etaData;
  if (status === 'arriving' || eta_minutes === 0) return { label: 'Arriving', cls: 'eta-arriving' };
  if (status === 'passed') return { label: 'Passed', cls: 'eta-grey' };
  if (eta_minutes <= 2) return { label: 'Arriving', cls: 'eta-arriving' };
  return { label: `${eta_minutes} min`, cls: 'eta-teal' };
}

export function getSourceBadge(src) {
  if (src === 'driver_live')   return { label: 'Driver Live',   cls: 'source-driver' };
  if (src === 'crowdsourced')  return { label: 'Crowdsourced',  cls: 'source-crowd' };
  return                              { label: 'Schedule only', cls: 'source-sched' };
}

export function getMapStyle() {
  return [
    { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'road',          elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.highway',  elementType: 'geometry', stylers: [{ color: '#e8e8e8' }] },
    { featureType: 'landscape',     stylers: [{ color: '#f5f5f5' }] },
    { featureType: 'water',         stylers: [{ color: '#c8dde8' }] },
    { featureType: 'administrative',elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
    { featureType: 'road',          elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  ];
}
