(function () {
  const timer = document.getElementById('timer');
  const tripStart = document.getElementById('trip-start');
  const mapBtn = document.getElementById('map');
  const overlay = document.getElementById('map-overlay');
  const closeBtn = document.getElementById('close');

  const fromCoords = JSON.parse(sessionStorage.getItem('transit_fromCoords') || 'null');
  const destCoord = JSON.parse(sessionStorage.getItem('transit_destCoord') || 'null');
  const routeCoords = JSON.parse(sessionStorage.getItem('transit_routeCoords') || 'null');
  const duration = parseFloat(sessionStorage.getItem('transit_duration') || '0');
  const endTimeMs = parseInt(sessionStorage.getItem('transit_timerEndTime') || '0', 10);
  const tripStarted = sessionStorage.getItem('transit_tripStarted') === 'true';

  // timer
  function fmt(secs) {
    if (secs <= 0) {
      return '00:00';
    }
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  let iv = null;
  function startTimerFromEnd(endMs) {
    clearInterval(iv);
    function tick() {
      const rem = Math.max(0, Math.round((endMs - Date.now()) / 1000));
      timer.textContent = fmt(rem);
      if (rem <= 60) {
        timer.classList.add('urgent');
      }
      if (rem <= 0) {
        clearInterval(iv);
      }
    }
    tick();
    iv = setInterval(tick, 1000);
  }

  if (tripStarted && endTimeMs > Date.now()) {
    timer.removeAttribute('hidden');
    startTimerFromEnd(endTimeMs);
  } else if (tripStarted) {
    timer.removeAttribute('hidden');
    timer.textContent = '00:00';
  } else if (duration > 0) {
    tripStart.removeAttribute('hidden');
    tripStart.addEventListener('click', () => {
      tripStart.setAttribute('hidden', '');
      timer.removeAttribute('hidden');
      const endMs = Date.now() + duration * 1000;
      sessionStorage.setItem('transit_timerEndTime', String(endMs));
      sessionStorage.setItem('transit_tripStarted', 'true');
      startTimerFromEnd(endMs);
    });
  }

  // map
  if (!routeCoords || !fromCoords) {
    return;
  }

  let map = null;

  function initMap() {
    if (map) {
      return;
    }
    map = L.map('map-content', { zoomControl: true })
            .setView([fromCoords.lat, fromCoords.lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const latlngs = routeCoords.map(c => [c[1], c[0]]);
    const routeLine = L.polyline(latlngs, {
      color: '#4a9eff', weight: 5, opacity: 0.85, lineJoin: 'round',
    }).addTo(map);

    if (destCoord) {
      L.marker([destCoord.lat, destCoord.lng]).addTo(map).bindPopup('Destination');
    }

    const icon = L.divIcon({
      className: 'current-pos-icon',
      html: '<div class="current-pos-dot"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    L.marker([fromCoords.lat, fromCoords.lng], { icon, zIndexOffset: 1000 }).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
  }

  function openMap() {
    overlay.classList.add('open');
    initMap();
    if (map) {
      setTimeout(() => map.invalidateSize(), 60);
    }
  }
  function closeMap() {
    overlay.classList.remove('open');
  }

  mapBtn.removeAttribute('hidden');
  mapBtn.disabled = false;
  mapBtn.addEventListener('click', openMap);
  closeBtn.addEventListener('click', closeMap);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) {
      closeMap();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeMap();
    }
  });
}());
