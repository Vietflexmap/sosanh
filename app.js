(() => {
  'use strict';

  const WORLD_URL = 'https://raw.githubusercontent.com/TheTrueSize/natural-earth-vector/main/geojson/ne_50m_admin_0_countries.geojson';
  const WB_INDICATOR = 'SP.POP.TOTL';
  const VIETNAM_ISO = 'VNM';
  const MAX_LAT = 84.8;

  const $ = (id) => document.getElementById(id);
  const ui = {
    select: $('countrySelect'), home: $('homeBtn'), targetName: $('targetName'), targetIso: $('targetIso'),
    vnArea: $('vnArea'), targetArea: $('targetArea'), areaRatio: $('areaRatio'),
    vnPopulation: $('vnPopulation'), targetPopulation: $('targetPopulation'), populationRatio: $('populationRatio'),
    vnDensity: $('vnDensity'), targetDensity: $('targetDensity'), densityRatio: $('densityRatio'),
    distortion: $('distortionFactor'), distortionBar: $('distortionBar'), status: $('dataStatus'),
    loading: $('loading'), info: $('infoDialog'), infoBtn: $('infoBtn'), closeInfo: $('closeInfo')
  };

  const map = L.map('map', {
    zoomControl: false,
    minZoom: 2,
    maxZoom: 10,
    worldCopyJump: true
  }).setView([17, 106], 4);

  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  let world;
  let countriesLayer;
  let targetLayer;
  let vnSource;
  let vnCenter;
  let vnAreaKm2 = 0;
  let vnOverlay;
  let handle;
  let currentTarget;
  let populationCache = new Map();
  let requestToken = 0;

  const countryName = f => f?.properties?.NAME_VI || f?.properties?.NAME || f?.properties?.ADMIN || 'Không rõ';
  const countryIso = f => {
    const p = f?.properties || {};
    const options = [p.ADM0_A3, p.ISO_A3, p.WB_A3, p.SOV_A3];
    return String(options.find(v => v && v !== '-99') || '').toUpperCase();
  };

  function formatArea(v) {
    if (!Number.isFinite(v)) return '—';
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v) + ' km²';
  }

  function formatPopulation(v) {
    if (!Number.isFinite(v)) return '—';
    if (v >= 1e9) return (v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ';
    if (v >= 1e6) return (v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' triệu';
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v);
  }

  function formatDensity(v) {
    if (!Number.isFinite(v)) return '—';
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v) + ' người/km²';
  }

  function ratioText(a, b, labelA = 'Quốc gia đích', labelB = 'Việt Nam') {
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return '—';
    const r = a / b;
    if (Math.abs(r - 1) < 0.01) return 'Gần tương đương ' + labelB;
    return r >= 1
      ? labelA + ' ≈ ' + r.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + '× ' + labelB
      : labelB + ' ≈ ' + (1 / r).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + '× ' + labelA;
  }

  function areaKm2(feature) {
    try { return turf.area(feature) / 1e6; } catch (_) { return NaN; }
  }

  function centerOf(feature) {
    try {
      const c = turf.centerOfMass(feature).geometry.coordinates;
      return [c[1], c[0]];
    } catch (_) {
      const c = turf.centroid(feature).geometry.coordinates;
      return [c[1], c[0]];
    }
  }

  function lonLatToVec(lon, lat) {
    const l = lon * Math.PI / 180;
    const p = lat * Math.PI / 180;
    const cp = Math.cos(p);
    return [cp * Math.cos(l), cp * Math.sin(l), Math.sin(p)];
  }

  function vecToLonLat(v) {
    const n = Math.hypot(v[0], v[1], v[2]) || 1;
    const x = v[0] / n, y = v[1] / n, z = v[2] / n;
    return [Math.atan2(y, x) * 180 / Math.PI, Math.asin(Math.max(-1, Math.min(1, z))) * 180 / Math.PI];
  }

  const dot = (a,b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const add = (a,b) => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
  const scale = (a,s) => [a[0]*s,a[1]*s,a[2]*s];

  function rotationMapper(fromLonLat, toLonLat) {
    const a = lonLatToVec(fromLonLat[0], fromLonLat[1]);
    const b = lonLatToVec(toLonLat[0], toLonLat[1]);
    const v = cross(a, b);
    const s = Math.hypot(v[0], v[1], v[2]);
    const c = Math.max(-1, Math.min(1, dot(a, b)));

    if (s < 1e-12) {
      if (c > 0) return x => x;
      const axis0 = Math.abs(a[0]) < 0.8 ? [1,0,0] : [0,1,0];
      const k0 = cross(a, axis0);
      const kn = Math.hypot(...k0);
      const k = scale(k0, 1 / kn);
      return x => add(scale(x, -1), scale(k, 2 * dot(k, x)));
    }

    const k = scale(v, 1 / s);
    return x => add(add(scale(x, c), scale(cross(k, x), s)), scale(k, dot(k, x) * (1 - c)));
  }

  function unwrapRing(ring, targetLon) {
    let prev = null;
    return ring.map(([lon, lat]) => {
      while (lon - targetLon > 180) lon -= 360;
      while (lon - targetLon < -180) lon += 360;
      if (prev !== null) {
        while (lon - prev > 180) lon -= 360;
        while (lon - prev < -180) lon += 360;
      }
      prev = lon;
      return [lon, lat];
    });
  }

  function rotateGeometry(geometry, targetLat, targetLon) {
    const sourceLonLat = [vnCenter[1], vnCenter[0]];
    const mapper = rotationMapper(sourceLonLat, [targetLon, targetLat]);

    const rotateRing = ring => unwrapRing(ring.map(([lon, lat]) => vecToLonLat(mapper(lonLatToVec(lon, lat)))), targetLon);
    let coordinates;

    if (geometry.type === 'Polygon') {
      coordinates = geometry.coordinates.map(rotateRing);
    } else if (geometry.type === 'MultiPolygon') {
      coordinates = geometry.coordinates.map(poly => poly.map(rotateRing));
    } else {
      throw new Error('Chỉ hỗ trợ Polygon/MultiPolygon');
    }
    return { type: geometry.type, coordinates };
  }

  function overlayFeature(lat, lon) {
    return {
      type: 'Feature',
      properties: { name: 'Việt Nam — kích thước thật' },
      geometry: rotateGeometry(vnSource.geometry, lat, lon)
    };
  }

  function mercatorAreaFactor(lat) {
    const p = Math.min(MAX_LAT, Math.max(-MAX_LAT, lat)) * Math.PI / 180;
    return 1 / Math.pow(Math.cos(p), 2);
  }

  function renderDistortion(lat) {
    const f = mercatorAreaFactor(lat);
    ui.distortion.textContent = f.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + '×';
    const pct = Math.max(4, Math.min(100, 4 + Math.log2(f) * 17));
    ui.distortionBar.style.width = pct + '%';
  }

  function updateOverlay(lat, lon, duringDrag = false) {
    lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
    if (vnOverlay) map.removeLayer(vnOverlay);
    vnOverlay = L.geoJSON(overlayFeature(lat, lon), {
      style: {
        color: '#a91017',
        weight: 2,
        fillColor: '#d71920',
        fillOpacity: 0.43
      },
      interactive: false
    }).addTo(map);
    renderDistortion(lat);
    if (!duringDrag) {
      vnOverlay.bringToFront();
      handle?.bringToFront?.();
    }
  }

  function featureAt(lat, lon) {
    const pt = turf.point([lon, lat]);
    for (const f of world.features) {
      try {
        if ((f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') && turf.booleanPointInPolygon(pt, f)) return f;
      } catch (_) {}
    }
    return null;
  }

  function paintTarget(feature) {
    if (targetLayer) map.removeLayer(targetLayer);
    if (!feature) return;
    targetLayer = L.geoJSON(feature, {
      style: { color: '#1b6ca8', weight: 2, fillColor: '#1b6ca8', fillOpacity: 0.12 },
      interactive: false
    }).addTo(map);
    targetLayer.bringToBack();
  }

  function naturalEarthPopulation(feature) {
    const p = feature?.properties || {};
    const value = Number(p.POP_EST);
    const year = Number(p.POP_YEAR) || null;
    return Number.isFinite(value) && value > 0 ? { value, year, source: 'Natural Earth' } : null;
  }

  async function getPopulation(feature) {
    const iso = countryIso(feature);
    if (!iso) return naturalEarthPopulation(feature);
    if (populationCache.has(iso)) return populationCache.get(iso);

    const promise = (async () => {
      try {
        const url = 'https://api.worldbank.org/v2/country/' + encodeURIComponent(iso) + '/indicator/' + WB_INDICATOR + '?format=json&per_page=70';
        const res = await fetch(url);
        if (!res.ok) throw new Error('World Bank ' + res.status);
        const json = await res.json();
        const rows = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
        const row = rows.find(r => r && r.value !== null && Number.isFinite(Number(r.value)));
        if (row) return { value: Number(row.value), year: Number(row.date), source: 'World Bank' };
      } catch (_) {}
      return naturalEarthPopulation(feature);
    })();

    populationCache.set(iso, promise);
    return promise;
  }

  async function updateComparison(feature) {
    currentTarget = feature || vnSource;
    paintTarget(currentTarget);
    const name = countryName(currentTarget);
    const iso = countryIso(currentTarget) || '—';
    const targetAreaKm2 = areaKm2(currentTarget);

    ui.targetName.textContent = name;
    ui.targetIso.textContent = iso;
    ui.vnArea.textContent = formatArea(vnAreaKm2);
    ui.targetArea.textContent = formatArea(targetAreaKm2);
    ui.areaRatio.textContent = ratioText(targetAreaKm2, vnAreaKm2, name, 'Việt Nam');

    ui.targetPopulation.textContent = '…';
    ui.vnPopulation.textContent = '…';
    ui.vnDensity.textContent = '…';
    ui.targetDensity.textContent = '…';
    ui.populationRatio.textContent = 'Đang tải dân số…';
    ui.densityRatio.textContent = '—';

    const token = ++requestToken;
    const [vnPop, targetPop] = await Promise.all([getPopulation(vnSource), getPopulation(currentTarget)]);
    if (token !== requestToken) return;

    const vp = vnPop?.value;
    const tp = targetPop?.value;
    const vd = Number.isFinite(vp) ? vp / vnAreaKm2 : NaN;
    const td = Number.isFinite(tp) ? tp / targetAreaKm2 : NaN;

    ui.vnPopulation.textContent = formatPopulation(vp);
    ui.targetPopulation.textContent = formatPopulation(tp);
    ui.vnDensity.textContent = formatDensity(vd);
    ui.targetDensity.textContent = formatDensity(td);
    ui.populationRatio.textContent = ratioText(tp, vp, name, 'Việt Nam') +
      (targetPop?.year ? ' · ' + targetPop.year : '');
    ui.densityRatio.textContent = ratioText(td, vd, name, 'Việt Nam');
    ui.status.textContent = 'Natural Earth · ' + (targetPop?.source || 'Dân số chưa có') + (targetPop?.year ? ' ' + targetPop.year : '') + ' · OSM';
  }

  function moveToFeature(feature, fit = false) {
    if (!feature) return;
    const [lat, lon] = centerOf(feature);
    handle.setLatLng([lat, lon]);
    updateOverlay(lat, lon);
    updateComparison(feature);
    ui.select.value = countryIso(feature);
    if (fit) {
      const b = L.geoJSON(feature).getBounds();
      if (b.isValid()) map.fitBounds(b.pad(0.45), { maxZoom: 5, animate: true });
    } else {
      map.panTo([lat, lon], { animate: true });
    }
  }

  function populateSelect() {
    const items = world.features
      .map(f => ({ f, name: countryName(f), iso: countryIso(f) }))
      .filter(x => x.iso)
      .sort((a,b) => a.name.localeCompare(b.name, 'vi'));

    ui.select.innerHTML = '<option value="">Chọn quốc gia…</option>' +
      items.map(x => '<option value="' + x.iso + '">' + escapeHtml(x.name) + '</option>').join('');
    ui.select.value = VIETNAM_ISO;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  async function init() {
    try {
      const res = await fetch(WORLD_URL);
      if (!res.ok) throw new Error('Không tải được Natural Earth (' + res.status + ')');
      world = await res.json();

      vnSource = world.features.find(f => countryIso(f) === VIETNAM_ISO || countryName(f).toLowerCase().includes('vietnam'));
      if (!vnSource) throw new Error('Không tìm thấy polygon Việt Nam trong dữ liệu.');
      vnCenter = centerOf(vnSource);
      vnAreaKm2 = areaKm2(vnSource);

      countriesLayer = L.geoJSON(world, {
        style: f => ({
          color: '#728078',
          weight: 0.65,
          fillColor: '#ffffff',
          fillOpacity: 0.08
        }),
        onEachFeature: (f, layer) => {
          layer.on('click', () => moveToFeature(f, true));
          layer.bindTooltip(countryName(f), { sticky: true, direction: 'top' });
        }
      }).addTo(map);

      handle = L.marker(vnCenter, {
        draggable: true,
        zIndexOffset: 1000,
        icon: L.divIcon({ className: 'vn-handle', html: '', iconSize: [20,20], iconAnchor: [10,10] })
      }).addTo(map);
      handle.bindTooltip('Kéo Việt Nam', { permanent: false, direction: 'top', className: 'vn-tooltip' });

      handle.on('drag', e => {
        const p = e.target.getLatLng();
        if (Math.abs(p.lat) > MAX_LAT) {
          p.lat = Math.sign(p.lat) * MAX_LAT;
          e.target.setLatLng(p);
        }
        updateOverlay(p.lat, p.lng, true);
        const f = featureAt(p.lat, p.lng);
        if (f && f !== currentTarget) {
          currentTarget = f;
          paintTarget(f);
          ui.targetName.textContent = countryName(f);
          ui.targetIso.textContent = countryIso(f) || '—';
        }
      });

      handle.on('dragend', e => {
        const p = e.target.getLatLng();
        const f = featureAt(p.lat, p.lng);
        updateOverlay(p.lat, p.lng);
        updateComparison(f || vnSource);
        ui.select.value = f ? countryIso(f) : '';
      });

      populateSelect();
      updateOverlay(vnCenter[0], vnCenter[1]);
      await updateComparison(vnSource);
      map.fitBounds(L.geoJSON(vnSource).getBounds().pad(0.9), { maxZoom: 5 });
      ui.loading.classList.add('hidden');
      setTimeout(() => ui.loading.remove(), 350);
    } catch (err) {
      ui.loading.innerHTML = '<strong>Không thể khởi tạo bản đồ</strong><span>' + escapeHtml(err.message || String(err)) + '</span>';
    }
  }

  ui.select.addEventListener('change', () => {
    const iso = ui.select.value;
    const f = world?.features?.find(x => countryIso(x) === iso);
    if (f) moveToFeature(f, true);
  });

  ui.home.addEventListener('click', () => moveToFeature(vnSource, true));
  ui.infoBtn.addEventListener('click', () => ui.info.showModal());
  ui.closeInfo.addEventListener('click', () => ui.info.close());
  ui.info.addEventListener('click', e => {
    if (e.target === ui.info) ui.info.close();
  });

  init();
})();
