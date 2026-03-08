let map = null;
let routeLine = null;
let current = null;
let dest = null;
let routeCoords = null; // lat, long
let watch = null;
let pos = null;
let destCoord = null;
let time = 0;
let remaining = 0;
let interval = null;
let navigating = false;
let reroute = false;
let lastReroute = 0;
let fade = null;
const OFF_ROUTE_ALLOW = 50;

const timer = document.getElementById('timer');
const map_button = document.getElementById('map');
const overlay = document.getElementById('map-overlay');
const close = document.getElementById('close');
const landing = document.getElementById('landing');
const start = document.getElementById('start');
const gps = document.getElementById('gps');
const fromInput = document.getElementById('from-input');
const toInput = document.getElementById('to-input');
const error = document.getElementById('error');
const back = document.getElementById('back');
const tripStart = document.getElementById('trip-start');

// timer
function formatTime(secs) {
  if (secs <= 0) {
    return '00:00';
  }
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startTimer(durationSeconds) {
  clearInterval(interval);
  remaining = Math.round(durationSeconds);
  timer.classList.remove('urgent', 'recalc');
  timer.textContent = formatTime(remaining);
  interval = setInterval(() => {
    remaining--;
    timer.textContent = formatTime(remaining);
    if (remaining <= 60) {
      timer.classList.add('urgent');
    }
    if (remaining <= 0) {
      clearInterval(interval);
    }
  }, 1000);
}

function startTimerFromEnd(endTimeMs) {
  clearInterval(interval);
  timer.classList.remove('urgent', 'recalc');
  function tick() {
    const rem = Math.max(0, Math.round((endTimeMs - Date.now()) / 1000));
    remaining = rem;
    timer.textContent = formatTime(rem);
    if (rem <= 60) {
      timer.classList.add('urgent');
    }
    if (rem <= 0) {
      clearInterval(interval);
    }
  }
  tick();
  interval = setInterval(tick, 1000);
}

// map
function openMap() {
  overlay.classList.add('open');
  if (map) {
    setTimeout(() => map.invalidateSize(), 60);
  }
}

function closeMap() {
  overlay.classList.remove('open');
}

map_button.addEventListener('click', openMap);
close.addEventListener('click', closeMap);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) {
    closeMap();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeMap();
  }
});

// start trip
tripStart.addEventListener('click', () => {
  tripStart.setAttribute('hidden', '');
  timer.removeAttribute('hidden');
  back.removeAttribute('hidden');
  navigating = true;
  startTimer(time);
  sessionStorage.setItem('transit_timerEndTime', String(Date.now() + time * 1000));
  sessionStorage.setItem('transit_tripStarted', 'true');
});

// back
back.addEventListener('click', () => {
  if (fade !== null) {
    clearTimeout(fade);
    fade = null;
  }
  if (watch !== null) {
    navigator.geolocation.clearWatch(watch);
    watch = null;
  }
  clearInterval(interval);
  routeCoords = null;
  destCoord = null;
  pos = null;
  time = 0;
  remaining = 0;
  navigating = false;
  reroute = false;
  lastReroute = 0;

  if (map) {
    if (routeLine) {
      map.removeLayer(routeLine);
      routeLine = null;
    }
    if (current) {
      map.removeLayer(current);
      current = null;
    }
    if (dest) {
      map.removeLayer(dest);
      dest = null;
    }
  }

  closeMap();
  back.setAttribute('hidden', '');
  tripStart.setAttribute('hidden', '');
  timer.setAttribute('hidden', '');
  timer.textContent = '';
  timer.classList.remove('urgent', 'recalc');
  map_button.setAttribute('hidden', '');
  map_button.disabled = true;

  fromInput.value = '';
  fromInput._gpsCoords = null;
  toInput.value = '';
  error.textContent = '';
  start.textContent = 'Start Navigation';
  start.disabled = false;
  gps.textContent = '📍';
  gps.disabled = false;

  ['transit_appState','transit_fromVal','transit_toVal','transit_fromCoords',
   'transit_destCoord','transit_routeCoords','transit_duration',
   'transit_timerEndTime','transit_tripStarted'].forEach(k => sessionStorage.removeItem(k));
  landing.classList.remove('fade-out');
  landing.style.display = 'flex';
});

// map
function initMap(center) {
  if (map) {
    return;
  }
  map = L.map('map-content', { zoomControl: true }).setView([center.lat, center.lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);
}

function drawRoute(from, to, coords) {
  initMap(from);

  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }
  if (dest) {
    map.removeLayer(dest);
    dest = null;
  }

  const latlngs = coords.map(c => [c[1], c[0]]);
  routeLine = L.polyline(latlngs, {
    color: '#4a9eff',
    weight: 5,
    opacity: 0.85,
    lineJoin: 'round',
  }).addTo(map);

  dest = L.marker([to.lat, to.lng])
    .addTo(map)
    .bindPopup('Destination');

  setCurrent(from);
  map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
}

function setCurrent(pos) {
  if (!map) {
    return;
  }
  const ll = [pos.lat, pos.lng];
  if (!current) {
    const icon = L.divIcon({
      className: 'current-pos-icon',
      html: '<div class="current-pos-dot"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    current = L.marker(ll, { icon, zIndexOffset: 1000 }).addTo(map);
  } else {
    current.setLatLng(ll);
  }
}

// geocode
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  if (!data.length) {
    throw new Error(`Location not found: "${query}"`);
  }
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  if (!data.address) {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
  const a = data.address;
  return [a.road, a.city || a.town || a.village || a.county].filter(Boolean).join(', ');
}

async function fetchRoute(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok') {
    throw new Error('Could not calculate route');
  }
  const r = data.routes[0];
  return { coords: r.geometry.coordinates, duration: r.duration, distance: r.distance };
}

function distanceBetween(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function distanceToSegment(point, segmentStart, segmentEnd) {
  const dx = segmentEnd.lng - segmentStart.lng;
  const dy = segmentEnd.lat - segmentStart.lat;
  const segmentLengthSquared = dx * dx + dy * dy;
  if (segmentLengthSquared === 0) {
    return distanceBetween(point, segmentStart);
  }
  const t = Math.max(0, Math.min(1,
    ((point.lng - segmentStart.lng) * dx + (point.lat - segmentStart.lat) * dy) / segmentLengthSquared
  ));
  const closestPoint = {
    lat: segmentStart.lat + t * dy,
    lng: segmentStart.lng + t * dx,
  };
  return distanceBetween(point, closestPoint);
}

function distToRoute(pos, coords) {
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = { lat: coords[i][1], lng: coords[i][0]     };
    const b = { lat: coords[i + 1][1], lng: coords[i + 1][0] };
    const d = distanceToSegment(pos, a, b);
    if (d < min) {
      min = d;
    }
  }
  return min;
}

async function handlePosition(position) {
  pos = {
    lat: position.coords.latitude, 
    lng: position.coords.longitude
  };
  if (!navigating || !destCoord) {
    return;
  }

  setCurrent(pos);

  if (distanceBetween(pos, destCoord) < 30) {
    clearInterval(interval);
    timer.classList.remove('urgent', 'recalc');
    timer.textContent = 'Arrived!';
    if (watch !== null) {
      navigator.geolocation.clearWatch(watch);
    }
    return;
  }

  // recalculate
  const now = Date.now();
  if (routeCoords && !reroute && now - lastReroute > 10000) {
    const d = distToRoute(pos, routeCoords);
    if (d > OFF_ROUTE_ALLOW) {
      lastReroute = now;
      reroute = true;
      clearInterval(interval);
      timer.classList.add('recalc');
      timer.textContent = 'Recalc…';
      try {
        const route = await fetchRoute(pos, destCoord);
        routeCoords = route.coords;
        drawRoute(pos, destCoord, route.coords);
        startTimer(route.duration);
      } catch (routeError) {
        startTimer(remaining);
      } finally {
        reroute = false;
      }
    }
  }
}

// gps button
gps.addEventListener('click', () => {
  if (!navigator.geolocation) {
    setError('Geolocation is not supported by your browser');
    return;
  }
  gps.textContent = '⏳';
  gps.disabled = true;
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const label = await reverseGeocode(position.coords.latitude, position.coords.longitude);
      fromInput.value = label;
      fromInput._gpsCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
      gps.textContent = '✅';
      gps.disabled = false;
    },
    () => {
      setError('Could not get your location');
      gps.textContent = '📍';
      gps.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
});

// start
function setError(msg) { 
  error.textContent = msg; 
}

start.addEventListener('click', async () => {
  const fromVal = fromInput.value.trim();
  const toVal = toInput.value.trim();
  if (!fromVal || !toVal) {
    setError('Please enter both a starting location and a destination');
    return;
  }
  setError('');
  start.textContent = 'Calculating route…';
  start.disabled = true;
  try {
    const from = fromInput._gpsCoords ? fromInput._gpsCoords : await geocode(fromVal);
    const to = await geocode(toVal);
    const route = await fetchRoute(from, to);
    sessionStorage.setItem('transit_fromVal', fromVal);
    sessionStorage.setItem('transit_toVal', toVal);
    sessionStorage.setItem('transit_fromCoords', JSON.stringify(from));
    sessionStorage.setItem('transit_destCoord', JSON.stringify(to));
    sessionStorage.setItem('transit_routeCoords', JSON.stringify(route.coords));
    sessionStorage.setItem('transit_duration', String(route.duration));
    sessionStorage.setItem('transit_appState', 'city-select');
    sessionStorage.removeItem('transit_tripStarted');
    sessionStorage.removeItem('transit_timerEndTime');
    window.location.href = 'city-select.html';
  } catch (err) {
    setError(err.message || 'Something went wrong — please try again');
    start.textContent = 'Start Navigation';
    start.disabled = false;
  }
});
