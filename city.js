(function () {
  const timerEl = document.getElementById('timer');
  const mapBtn = document.getElementById('map');
  const overlay = document.getElementById('map-overlay');
  const closeBtn = document.getElementById('close');

  const endTimeMs = parseInt(sessionStorage.getItem('transit_timerEndTime') || '0', 10);
  const tripStarted = sessionStorage.getItem('transit_tripStarted') === 'true';
  const fromCoords = JSON.parse(sessionStorage.getItem('transit_fromCoords') || 'null');
  const destCoord = JSON.parse(sessionStorage.getItem('transit_destCoord') || 'null');
  const routeCoords = JSON.parse(sessionStorage.getItem('transit_routeCoords') || 'null');

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

  if (tripStarted && endTimeMs) {
    timerEl.removeAttribute('hidden');
    let iv;
    function tick() {
      const rem = Math.max(0, Math.round((endTimeMs - Date.now()) / 1000));
      timerEl.textContent = fmt(rem);
      if (rem <= 60) {
        timerEl.classList.add('urgent');
      }
      if (rem <= 0) {
        clearInterval(iv);
      }
    }
    tick();
    iv = setInterval(tick, 1000);
  }

  // map
  if (!routeCoords || !fromCoords || !mapBtn || !overlay) {
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

    const latlngs = routeCoords.map(function(c) { return [c[1], c[0]]; });
    const routeLine = L.polyline(latlngs, {
      color: '#4a9eff', weight: 5, opacity: 0.85, lineJoin: 'round',
    }).addTo(map);

    if (destCoord) {
      L.marker([destCoord.lat, destCoord.lng]).addTo(map).bindPopup('Destination');
    }

    const icon = L.divIcon({
      className: 'current-pos-icon',
      html: '<div class="current-pos-dot"></div>',
      iconSize: [18, 18], iconAnchor: [9, 9],
    });
    L.marker([fromCoords.lat, fromCoords.lng], { icon, zIndexOffset: 1000 }).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
  }

  function openMap() {
    overlay.classList.add('open');
    initMap();
    if (map) {
      setTimeout(function() { map.invalidateSize(); }, 60);
    }
  }
  function closeMap() {
    overlay.classList.remove('open');
  }

  mapBtn.removeAttribute('hidden');
  mapBtn.disabled = false;
  mapBtn.addEventListener('click', openMap);
  if (closeBtn) {
    closeBtn.addEventListener('click', closeMap);
  }
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      closeMap();
    }
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeMap();
    }
  });
});
