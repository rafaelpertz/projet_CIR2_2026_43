/**
 * carte.js — BreizhOhm · Page Carte
 * Groupe 43 · CIR2 · ISEN Ouest · 2026
 */

const API_BASE = 'api';

let carteLeaflet       = null;
let routeLayerPolyline = null;
let routeRayon         = 10;

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'carte') {
    chargerFiltresCarte();
    initCarteLeaflet();
  }
});

/* ============================================================
   PEUPLEMENT DES <SELECT> VIA API
   ============================================================ */

async function chargerFiltresCarte() {
  await chargerSelect('carte-prise',     `${API_BASE}/types-prise`,                  'libelle',       'id');
  await chargerSelect('carte-amenageur', `${API_BASE}/amenageurs?limit=20&random=1`, 'nom_amenageur', 'id');
}

async function chargerSelect(selectId, url, labelKey, valueKey) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  try {
    const reponse = await fetch(url);
    if (!reponse.ok) {
      const corps = await reponse.text();
      throw new Error(`HTTP ${reponse.status} — ${corps}`);
    }
    const donnees = await reponse.json();

    donnees.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item[valueKey] ?? '';
      opt.textContent = item[labelKey] ?? '—';
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error(`Erreur chargement filtre (${url}) :`, err);
    const opt = document.createElement('option');
    opt.disabled = true;
    opt.textContent = '⚠ Erreur de chargement';
    sel.appendChild(opt);
  }
}

/* ============================================================
   CARTE LEAFLET
   ============================================================ */

function initCarteLeaflet() {
  const container = document.getElementById('carte-leaflet-container');
  if (!container) return;

  carteLeaflet = L.map('carte-leaflet-container', { minZoom: 8 }).setView([48.15, -2.9], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18
  }).addTo(carteLeaflet);
}

async function afficherCarte() {
  if (!carteLeaflet) initCarteLeaflet();

  const nom          = document.getElementById('carte-nom').value.trim();
  const annee        = document.getElementById('carte-annee').value;
  const dept         = document.getElementById('carte-dept').value;
  const prise        = document.getElementById('carte-prise').value;
  const amenageur    = document.getElementById('carte-amenageur').value;
  const puissanceMin = document.getElementById('carte-puissance-min').value;

  const params = new URLSearchParams();
  if (nom)          params.append('nom', nom);
  if (annee)        params.append('annee', annee);
  if (dept)         params.append('dept', dept);
  if (prise)        params.append('prise', prise);
  if (amenageur)    params.append('amenageur', amenageur);
  if (puissanceMin) params.append('puissance_min', puissanceMin);

  try {
    const reponse = await fetch(`${API_BASE}/installations/carte?${params.toString()}`);
    if (!reponse.ok) {
      const corps = await reponse.text();
      throw new Error(`HTTP ${reponse.status} — ${corps}`);
    }
    const points = await reponse.json();
    console.log(points);
    afficherMarqueurs(points);
  } catch (err) {
    console.error('Erreur chargement carte :', err);
    document.getElementById('carte-count').textContent = '⚠ Erreur';
  }
}

function afficherMarqueurs(points) {
  carteLeaflet.eachLayer(layer => {
    if (layer instanceof L.Marker) carteLeaflet.removeLayer(layer);
  });

  document.getElementById('carte-count').textContent = points.length;

  points.forEach(pt => {
    const lat = parseFloat(pt.lat);
    const lon = parseFloat(pt.lon);
    if (isNaN(lat) || isNaN(lon)) return;

    const marker = L.marker([lat, lon]).addTo(carteLeaflet);
    marker.bindTooltip(pt.commune || '—', { direction: 'top', offset: [0, -8] });
    marker.on('click', () => ouvrirPopupStation(marker, pt.station_id, pt.commune));
  });
}

/* ============================================================
   POPUP STATION
   ============================================================ */

async function ouvrirPopupStation(marker, stationId, commune) {
  marker.bindPopup(
    '<div class="popup-loading">Chargement…</div>',
    { maxWidth: 360, minWidth: 260 }
  ).openPopup();

  try {
    const res = await fetch(`${API_BASE}/pdcs?station=${encodeURIComponent(stationId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const pdcs = await res.json();

    if (!pdcs.length) {
      marker.getPopup().setContent(`
        <div class="popup-station">
          <div class="popup-station-title">${commune || 'Station'}</div>
          <p class="popup-pdc-meta" style="margin-top:8px">Aucun point de charge.</p>
        </div>`);
      return;
    }

    const rows = pdcs.map(pdc => `
      <div class="popup-pdc-item">
        <div class="popup-pdc-info">
          <div class="popup-pdc-type">${pdc.type_prise || '—'}</div>
          <div class="popup-pdc-meta">
            ${pdc.puissance_nominale ? pdc.puissance_nominale + ' kW' : '—'}
            ${pdc.acces_recharge ? ' · ' + pdc.acces_recharge : ''}
          </div>
          <div class="popup-pdc-date">${formatDateMoisAnnee(pdc.date_mise_service)}</div>
        </div>
        ${pdc.id
          ? `<a href="recherche.html?detail=${pdc.id}" class="popup-pdc-link">Voir détail →</a>`
          : ''}
      </div>`).join('');

    marker.getPopup().setContent(`
      <div class="popup-station">
        <div class="popup-station-title">${commune || 'Station'}</div>
        <div class="popup-pdc-count">${pdcs.length} point${pdcs.length > 1 ? 's' : ''} de charge</div>
        ${rows}
      </div>`);

  } catch (err) {
    marker.getPopup().setContent(
      '<div class="popup-error">⚠ Erreur de chargement</div>'
    );
    console.error('Erreur PDC station :', err);
  }
}

/* ============================================================
   ITINÉRAIRE
   ============================================================ */

function toggleRoutePanel() {
  const panel  = document.getElementById('route-panel');
  const toggle = document.getElementById('route-toggle');
  const label  = document.getElementById('toggle-label');
  const isOpen = panel.classList.toggle('open');

  toggle.classList.toggle('panel-open', isOpen);
  label.textContent = isOpen ? 'Fermer' : 'Itinéraire';
}

function setRayon(km) {
  routeRayon = km;
  document.querySelectorAll('.rayon-chip').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.km) === km);
  });
}

async function geocoderVille(nom) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(nom + ', France')}&format=json&limit=1&accept-language=fr`;
  const res  = await fetch(url, { headers: { 'User-Agent': 'BreizhOhm/1.0' } });
  const data = await res.json();
  if (!data.length) throw new Error(`Ville introuvable : "${nom}"`);
  return {
    lat:   parseFloat(data[0].lat),
    lon:   parseFloat(data[0].lon),
    label: data[0].display_name.split(',')[0].trim(),
  };
}

async function calculerRoute(depart, arrivee) {
  const url = [
    'https://router.project-osrm.org/route/v1/driving/',
    `${depart.lon},${depart.lat};${arrivee.lon},${arrivee.lat}`,
    '?geometries=geojson&overview=full',
  ].join('');

  const res  = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error('Impossible de calculer cet itinéraire.');

  return data.routes[0].geometry.coordinates;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R  = 6371;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distancePointSegment(pLat, pLon, aLat, aLon, bLat, bLon) {
  const dx   = bLon - aLon;
  const dy   = bLat - aLat;
  const len2 = dx * dx + dy * dy;

  if (len2 === 0) return haversine(pLat, pLon, aLat, aLon);

  const t = Math.max(0, Math.min(1, ((pLon - aLon) * dx + (pLat - aLat) * dy) / len2));

  return haversine(pLat, pLon, aLat + t * dy, aLon + t * dx);
}

function filtrerBornesSurRoute(bornes, routeCoords, rayon) {
  return bornes.filter(b => {
    const lat = parseFloat(b.lat);
    const lon = parseFloat(b.lon);
    if (isNaN(lat) || isNaN(lon)) return false;

    for (let i = 0; i < routeCoords.length - 1; i++) {
      const [aLon, aLat] = routeCoords[i];
      const [bLon, bLat] = routeCoords[i + 1];
      if (distancePointSegment(lat, lon, aLat, aLon, bLat, bLon) <= rayon) {
        return true;
      }
    }
    return false;
  });
}

function afficherTrace(routeCoords, ptDepart, ptArrivee) {
  if (!carteLeaflet) initCarteLeaflet();

  if (routeLayerPolyline) carteLeaflet.removeLayer(routeLayerPolyline);

  const latlngs = routeCoords.map(([lon, lat]) => [lat, lon]);

  routeLayerPolyline = L.polyline(latlngs, {
    color:   '#e63946',
    weight:  5,
    opacity: 0.85,
  }).addTo(carteLeaflet);

  const makeIcon = color => L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>`,
    iconAnchor: [7, 7],
  });

  L.marker([ptDepart.lat,  ptDepart.lon],  { icon: makeIcon('#22c55e') })
    .addTo(carteLeaflet)
    .bindPopup(`<b>Départ :</b> ${ptDepart.label}`);

  L.marker([ptArrivee.lat, ptArrivee.lon], { icon: makeIcon('#e63946') })
    .addTo(carteLeaflet)
    .bindPopup(`<b>Arrivée :</b> ${ptArrivee.label}`);

  carteLeaflet.fitBounds(routeLayerPolyline.getBounds(), { padding: [40, 40] });
}

function setRouteStatus(msg, type = '') {
  const el = document.getElementById('route-status');
  el.textContent   = msg;
  el.className     = 'route-status ' + type;
}

function afficherResultatsRoute(bornes) {
  const el = document.getElementById('route-results');

  if (!bornes.length) {
    el.innerHTML = `<p class="route-no-result">
      Aucune borne trouvée à moins de ${routeRayon} km de ce trajet.<br>
      Essayez d'augmenter le rayon de recherche.
    </p>`;
    return;
  }

  el.innerHTML = `
    <div class="route-count">${bornes.length} borne${bornes.length > 1 ? 's' : ''} sur le trajet</div>
    <ul class="route-list">
      ${bornes.map(b => `
        <li class="route-list-item">
          <span class="route-item-icon">⚡</span>
          <div class="route-item-info">
            <strong>${b.commune || '—'}</strong>
            <span>${b.puissance_nominale ? b.puissance_nominale + ' kW' : '—'} · ${b.type_prise || '—'}</span>
          </div>
          ${b.id ? `<a href="recherche.html?detail=${b.id}" class="route-item-link" title="Voir le détail">→</a>` : ''}
        </li>
      `).join('')}
    </ul>`;
}

async function chercherItineraire() {
  const depart  = document.getElementById('route-depart').value.trim();
  const arrivee = document.getElementById('route-arrivee').value.trim();

  if (!depart || !arrivee) {
    setRouteStatus('⚠ Veuillez saisir un départ et une arrivée.', 'warn');
    return;
  }

  document.getElementById('route-results').innerHTML = '';
  setRouteStatus('Géocodage des villes…', 'loading');

  try {
    const ptDepart  = await geocoderVille(depart);
    const ptArrivee = await geocoderVille(arrivee);

    setRouteStatus('Calcul de l\'itinéraire…', 'loading');

    const routeCoords = await calculerRoute(ptDepart, ptArrivee);

    carteLeaflet.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        carteLeaflet.removeLayer(layer);
      }
    });
    afficherTrace(routeCoords, ptDepart, ptArrivee);

    setRouteStatus('Chargement des bornes…', 'loading');

    const lats   = routeCoords.map(c => c[1]);
    const lons   = routeCoords.map(c => c[0]);
    const buffer = 0.15;
    const bbox   = [
      Math.min(...lons) - buffer,
      Math.min(...lats) - buffer,
      Math.max(...lons) + buffer,
      Math.max(...lats) + buffer,
    ].join(',');

    const filtreParams = new URLSearchParams({ bbox });
    const filtreNom       = document.getElementById('carte-nom')?.value.trim();
    const filtreAnnee     = document.getElementById('carte-annee')?.value;
    const filtreDept      = document.getElementById('carte-dept')?.value;
    const filtrePrise     = document.getElementById('carte-prise')?.value;
    const filtreAmenageur = document.getElementById('carte-amenageur')?.value;
    const filtrePuissance = document.getElementById('carte-puissance-min')?.value;
    if (filtreNom)       filtreParams.append('nom',          filtreNom);
    if (filtreAnnee)     filtreParams.append('annee',        filtreAnnee);
    if (filtreDept)      filtreParams.append('dept',         filtreDept);
    if (filtrePrise)     filtreParams.append('prise',        filtrePrise);
    if (filtreAmenageur) filtreParams.append('amenageur',    filtreAmenageur);
    if (filtrePuissance) filtreParams.append('puissance_min', filtrePuissance);

    const res    = await fetch(`${API_BASE}/installations/carte?${filtreParams.toString()}`);
    const bornes = await res.json();

    const bornesFiltrees = filtrerBornesSurRoute(bornes, routeCoords, routeRayon);

    afficherMarqueurs(bornesFiltrees);
    document.getElementById('carte-count').textContent = bornesFiltrees.length;

    afficherResultatsRoute(bornesFiltrees);
    setRouteStatus('', '');

  } catch (err) {
    setRouteStatus('❌ ' + err.message, 'error');
  }
}

/* ============================================================
   UTILITAIRES
   ============================================================ */

function formatDateMoisAnnee(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
