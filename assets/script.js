/**
 * script.js — BreizhOhm Front-End
 * Groupe 43 · CIR2 · ISEN Ouest · 2026
 *
 * Responsabilités :
 *  - Navigation entre les pages (SPA)
 *  - Peuplement des <select> via appels API REST (AJAX/JSON)
 *  - Fonctionnalité 3 : recherche + affichage tableau résultats
 *  - Fonctionnalité 4 : affichage détail d'une installation
 *  - Fonctionnalité 5 : carte Leaflet avec marqueurs
 *  - Graphiques de la page d'accueil
 */

/* ============================================================
   CONFIGURATION API
   ============================================================ */
const API_BASE = '/api'; // Racine de l'API PHP REST

/* ============================================================
   NAVIGATION ENTRE PAGES
   ============================================================ */
let carteLeaflet = null;      // Instance Leaflet (page carte)
let detailMapLeaflet = null;  // Instance Leaflet (page détail)

/**
 * Bascule entre les sous-vues d'une même page HTML (ex: search ↔ detail).
 * La navigation inter-pages se fait via des liens <a href>.
 * @param {string} name - Identifiant de la vue (search, detail)
 */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + name);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

/* ============================================================
   INITIALISATION AU CHARGEMENT DE LA PAGE
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;

  if (page === 'home') {
    buildYearChart();
    buildDeptChart();
    buildCrossTable();
  }

  if (page === 'recherche') {
    chargerFiltresRecherche();
    // Si on arrive depuis la carte avec ?detail=id, afficher directement le détail
    const params = new URLSearchParams(window.location.search);
    const detailId = params.get('detail');
    if (detailId) {
      afficherDetail(parseInt(detailId));
    }
  }

  if (page === 'carte') {
    chargerFiltresCarte();
    initCarteLeaflet();
  }
});

/* ============================================================
   GRAPHIQUES DE LA PAGE D'ACCUEIL
   ============================================================ */

/** Données statiques des installations par année (issues du CSV IRVE) */
const yearData = [
  {y:'2014',v:4},{y:'2015',v:13},{y:'2016',v:273},{y:'2017',v:279},
  {y:'2018',v:36},{y:'2019',v:56},{y:'2020',v:25},{y:'2021',v:107},
  {y:'2022',v:388},{y:'2023',v:945},{y:'2024',v:623},{y:'2025',v:545},{y:'2026',v:21}
];

/** Données statiques par département */
const deptData = [
  {label:'35 – Ille-et-Vilaine', v:1437},
  {label:'56 – Morbihan',        v:1318},
  {label:'29 – Finistère',       v:698},
  {label:'22 – Côtes-d\'Armor',  v:644},
];

/** Données croisées année × département (extrait représentatif) */
const crossData = [
  {annee:'2016', d29:80, d22:60, d56:72, d35:61},
  {annee:'2017', d29:75, d22:58, d56:80, d35:66},
  {annee:'2018', d29:8,  d22:6,  d56:10, d35:12},
  {annee:'2019', d29:12, d22:9,  d56:14, d35:21},
  {annee:'2020', d29:5,  d22:4,  d56:6,  d35:10},
  {annee:'2021', d29:22, d22:18, d56:28, d35:39},
  {annee:'2022', d29:88, d22:72, d56:95, d35:133},
  {annee:'2023', d29:210,d22:165,d56:215,d35:355},
  {annee:'2024', d29:138,d22:110,d56:142,d35:233},
  {annee:'2025', d29:120,d22:96, d56:125,d35:204},
];

/**
 * Construit le graphique en barres "installations par année".
 */
function buildYearChart() {
  const container = document.getElementById('year-chart');
  if (!container) return;
  const maxVal = Math.max(...yearData.map(d => d.v));
  yearData.forEach(d => {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <span class="bar-label">${d.y}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:0%" data-w="${(d.v / maxVal) * 100}%"></div>
      </div>
      <span class="bar-val">${d.v}</span>`;
    container.appendChild(row);
  });
  // Animation d'entrée
  setTimeout(() => {
    container.querySelectorAll('.bar-fill').forEach(b => {
      b.style.width = b.dataset.w;
    });
  }, 200);
}

/**
 * Construit le graphique en barres "répartition par département".
 */
function buildDeptChart() {
  const container = document.getElementById('dept-chart');
  if (!container) return;
  const maxVal = Math.max(...deptData.map(d => d.v));
  deptData.forEach(d => {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <span class="bar-label-long">${d.label}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:0%" data-w="${(d.v / maxVal) * 100}%"></div>
      </div>
      <span class="bar-val">${d.v}</span>`;
    container.appendChild(row);
  });
  setTimeout(() => {
    container.querySelectorAll('.bar-fill').forEach(b => {
      b.style.width = b.dataset.w;
    });
  }, 300);
}

/**
 * Remplit le tableau croisé année × département.
 */
function buildCrossTable() {
  const tbody = document.querySelector('#cross-table tbody');
  if (!tbody) return;
  crossData.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.annee}</td>
      <td>${row.d29}</td>
      <td>${row.d22}</td>
      <td>${row.d56}</td>
      <td>${row.d35}</td>`;
    tbody.appendChild(tr);
  });
}

/* ============================================================
   FONCTIONNALITÉ 2 — PEUPLEMENT DES <SELECT> VIA API
   ============================================================ */

/**
 * Charge les options des selects du formulaire de recherche (recherche.html).
 */
async function chargerFiltresRecherche() {
  await chargerSelect('sel-amenageur', `${API_BASE}/amenageurs?limit=20&random=1`, 'nom_amenageur', 'id');
  await chargerSelect('sel-operateur', `${API_BASE}/operateurs`,                   'nom',           'id');
  await chargerSelect('sel-prise',     `${API_BASE}/types-prise`,                  'libelle',       'id');
  await chargerSelect('sel-dept',      `${API_BASE}/departements`,                 'nom',           'code');
  await chargerSelect('sel-acces',     `${API_BASE}/conditions-acces`,             'libelle',       'id');
}

/**
 * Charge les options des selects du formulaire de la carte (carte.html).
 */
async function chargerFiltresCarte() {
  await chargerSelect('carte-prise',     `${API_BASE}/types-prise`,                  'libelle',       'id');
  await chargerSelect('carte-amenageur', `${API_BASE}/amenageurs?limit=20&random=1`, 'nom_amenageur', 'id');
}

/**
 * Remplit un élément <select> avec les données retournées par une URL d'API.
 * @param {string} selectId   - ID du <select> à remplir
 * @param {string} url        - URL de l'API
 * @param {string} labelKey   - Clé JSON pour le texte de l'option
 * @param {string} valueKey   - Clé JSON pour la valeur de l'option
 */
async function chargerSelect(selectId, url, labelKey, valueKey) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  try {
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
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
   FONCTIONNALITÉ 3 — TABLEAU DE RÉSULTATS (sans changer de page)
   ============================================================ */

/**
 * Déclenche la recherche en appelant l'API REST avec les filtres sélectionnés.
 * Affiche le tableau de résultats sous le formulaire sans changer de page.
 * Route : GET /api/installations?amenageur=&prise=&dept=
 */
async function lancerRecherche() {
  const nom          = document.getElementById('sel-nom').value.trim();
  const amenageur    = document.getElementById('sel-amenageur').value;
  const operateur    = document.getElementById('sel-operateur').value;
  const prise        = document.getElementById('sel-prise').value;
  const dept         = document.getElementById('sel-dept').value;
  const puissanceMin = document.getElementById('sel-puissance-min').value;
  const acces        = document.getElementById('sel-acces').value;
  const gratuit      = document.getElementById('sel-gratuit').value;

  const params = new URLSearchParams();
  if (nom)          params.append('nom', nom);
  if (amenageur)    params.append('amenageur', amenageur);
  if (operateur)    params.append('operateur', operateur);
  if (prise)        params.append('prise', prise);
  if (dept)         params.append('dept', dept);
  if (puissanceMin) params.append('puissance_min', puissanceMin);
  if (acces)        params.append('acces', acces);
  if (gratuit !== '') params.append('gratuit', gratuit);

  const url = `${API_BASE}/installations?${params.toString()}`;

  try {
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    const donnees = await reponse.json();
    afficherTableauResultats(donnees);
  } catch (err) {
    console.error('Erreur recherche :', err);
    afficherTableauResultats([]);
    const section = document.getElementById('results-section');
    const count   = document.getElementById('results-count');
    if (count) count.textContent = '⚠ Erreur de connexion à la base de données';
    if (section) section.style.display = 'block';
  }
}

/**
 * Remplit et affiche le tableau de résultats.
 * Colonnes : Date MES, Nb points, Type prise, Puissance, Localisation, Détails
 * @param {Array} installations - Tableau d'objets retourné par l'API
 */
function afficherTableauResultats(installations) {
  const section = document.getElementById('results-section');
  const tbody   = document.getElementById('results-tbody');
  const countEl = document.getElementById('results-count');

  tbody.innerHTML = '';
  countEl.textContent = `${installations.length} résultat(s)`;

  installations.forEach(inst => {
    // Formatage date : mois et année seulement
    const dateMES = formatDateMoisAnnee(inst.date_mise_en_service);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${dateMES}</td>
      <td>${inst.nbre_pdc ?? '—'}</td>
      <td>${inst.type_prise ?? '—'}</td>
      <td>${inst.puissance_nominale ? inst.puissance_nominale + ' kW' : '—'}</td>
      <td>${inst.commune ?? ''} ${inst.code_dept ? '(' + inst.code_dept + ')' : ''}</td>
      <td>
        <button class="btn-detail" onclick="afficherDetail(${inst.id ?? 0})">
          Voir le détail
        </button>
      </td>`;
    tbody.appendChild(tr);
  });

  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Formate une date ISO en "mois/année" (ex: "06/2022").
 * @param {string} dateStr
 * @returns {string}
 */
function formatDateMoisAnnee(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/* ============================================================
   FONCTIONNALITÉ 4 — DÉTAIL D'UNE INSTALLATION
   ============================================================ */

/**
 * Récupère les détails d'une installation via l'API et affiche la page détail.
 * Route : GET /api/installations/{id}
 * @param {number} id - Identifiant de l'installation
 */
async function afficherDetail(id) {
  try {
    const reponse = await fetch(`${API_BASE}/installations/${id}`);
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    const inst = await reponse.json();
    remplirPageDetail(inst);
  } catch (err) {
    console.error('Erreur chargement détail :', err);
    document.getElementById('dp-title').textContent = '⚠ Erreur de chargement';
  }
  showPage('detail');
}

/**
 * Remplit la page détail avec les données d'une installation.
 * @param {Object} inst
 */
function remplirPageDetail(inst) {
  document.getElementById('dp-title').textContent =
    `Détail — ${inst.nom_enseigne || inst.nom_amenageur || 'Installation #' + inst.id}`;

  setText('dp-amenageur',   inst.nom_amenageur);
  setText('dp-operateur',   inst.nom_operateur);
  setText('dp-enseigne',    inst.nom_enseigne);
  setText('dp-id-station',  inst.id_station);
  setText('dp-date',        formatDateMoisAnnee(inst.date_mise_en_service));
  setText('dp-pdc',         inst.nbre_pdc);
  setText('dp-prise',       inst.type_prise);
  setText('dp-puissance',   inst.puissance_nominale ? inst.puissance_nominale + ' kW' : '—');
  setText('dp-acces',       inst.acces_recharge);
  setText('dp-horaires',    inst.horaires);
  setText('dp-adresse',     inst.adresse_station);
  setText('dp-commune',     inst.commune);
  setText('dp-dept',        inst.code_dept ? inst.code_dept + ' – ' + (inst.nom_dept || '') : '—');
  setText('dp-coords',      inst.coordonneesXY_lat ? `${inst.coordonneesXY_lat}, ${inst.coordonneesXY_lon}` : '—');

  // Mini-carte Leaflet pour positionner la borne
  const lat = parseFloat(inst.coordonneesXY_lat);
  const lon = parseFloat(inst.coordonneesXY_lon);
  if (!isNaN(lat) && !isNaN(lon)) {
    setTimeout(() => initDetailMap(lat, lon, inst.nom_enseigne || inst.nom_amenageur || ''), 100);
  }
}

/** Utilitaire : remplit le textContent d'un élément */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

/** Initialise la mini-carte Leaflet sur la page détail. */
function initDetailMap(lat, lon, titre) {
  const container = document.getElementById('dp-map-container');
  if (!container) return;

  if (detailMapLeaflet) {
    detailMapLeaflet.remove();
    detailMapLeaflet = null;
  }

  detailMapLeaflet = L.map('dp-map-container').setView([lat, lon], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(detailMapLeaflet);
  L.marker([lat, lon]).addTo(detailMapLeaflet).bindPopup(titre).openPopup();
}

/* ============================================================
   FONCTIONNALITÉ 5 — CARTE OPENSTREETMAP / LEAFLET
   ============================================================ */

/** Initialise la carte Leaflet centrée sur la Bretagne. */
function initCarteLeaflet() {
  const container = document.getElementById('carte-leaflet-container');
  if (!container) return;

  carteLeaflet = L.map('carte-leaflet-container').setView([48.15, -2.9], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18
  }).addTo(carteLeaflet);
}

/**
 * Charge et affiche les bornes filtrées sur la carte Leaflet.
 * Route : GET /api/installations/carte?annee=&dept=
 */
async function afficherCarte() {
  if (!carteLeaflet) initCarteLeaflet();

  const nom         = document.getElementById('carte-nom').value.trim();
  const annee       = document.getElementById('carte-annee').value;
  const dept        = document.getElementById('carte-dept').value;
  const prise       = document.getElementById('carte-prise').value;
  const amenageur   = document.getElementById('carte-amenageur').value;
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
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    const points = await reponse.json();
    console.log(points)
    afficherMarqueurs(points);
  } catch (err) {
    console.error('Erreur chargement carte :', err);
    document.getElementById('carte-count').textContent = '⚠ Erreur';
  }
}

/**
 * Ajoute les marqueurs sur la carte Leaflet.
 * Chaque marqueur comporte un popup (localité, puissance) et un lien vers le détail.
 * @param {Array} points
 */
function afficherMarqueurs(points) {
  // Supprimer les marqueurs précédents
  if (carteLeaflet._layers) {
    carteLeaflet.eachLayer(layer => {
      if (layer instanceof L.Marker) carteLeaflet.removeLayer(layer);
    });
  }

  document.getElementById('carte-count').textContent = points.length;
  console.log(points)

  points.forEach(pt => {
    const lat = parseFloat(pt.lat);
    const lon = parseFloat(pt.lon);
    if (isNaN(lat) || isNaN(lon)) return;

    // Popup : station, nb PDC, puissance max, types de prise
    const detailUrl = `recherche.html?detail=${pt.id ?? ''}`;
    const popupHtml = `
      <div style="font-family:sans-serif;min-width:160px;">
        <strong>${pt.commune || '—'}</strong><br>
        Points de charge : ${pt.nbre_pdc ?? '—'}<br>
        Puissance max : ${pt.puissance_nominale ? pt.puissance_nominale + ' kW' : '—'}<br>
        Types : ${pt.type_prise || '—'}<br>
        ${pt.id ? `<a href="${detailUrl}" style="margin-top:6px;display:inline-block;">Voir le détail →</a>` : ''}
      </div>`;

    L.marker([lat, lon]).addTo(carteLeaflet).bindPopup(popupHtml);
  });
}


/* ================================================================
   FONCTIONNALITÉ ITINÉRAIRE
   Panneau coulissant + calcul de route OSRM + filtrage des bornes
   ================================================================

   APIs utilisées (gratuites, sans clé) :
     - Nominatim (OpenStreetMap) : convertit un nom de ville en coordonnées GPS
     - OSRM : calcule l'itinéraire routier entre deux points
   ================================================================ */

let routeLayerPolyline = null; // La ligne du trajet sur la carte
let routeRayon         = 10;   // Rayon de recherche en km (modifié via setRayon())

/**
 * Ouvre ou ferme le panneau itinéraire.
 * Déplace aussi le bouton toggle pour qu'il reste visible.
 */
function toggleRoutePanel() {
  const panel  = document.getElementById('route-panel');
  const toggle = document.getElementById('route-toggle');
  const label  = document.getElementById('toggle-label');
  const isOpen = panel.classList.toggle('open');

  toggle.classList.toggle('panel-open', isOpen);
  label.textContent = isOpen ? 'Fermer' : 'Itinéraire';
}

/**
 * Sélectionne un rayon de recherche et met en surbrillance le chip actif.
 * @param {number} km - Valeur en kilomètres (5, 10 ou 20)
 */
function setRayon(km) {
  routeRayon = km;
  document.querySelectorAll('.rayon-chip').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.km) === km);
  });
}

/**
 * Géocode un nom de ville en coordonnées GPS via Nominatim.
 * On restreint la recherche à la France pour plus de précision.
 * @param {string} nom - Nom de la ville (ex: "Brest")
 * @returns {Promise<{lat, lon, label}>}
 */
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

/**
 * Calcule l'itinéraire routier entre deux points via OSRM.
 * OSRM est gratuit, open source et ne nécessite pas de clé API.
 * @returns {Promise<Array>} Tableau de coordonnées [[lon, lat], ...]
 */
async function calculerRoute(depart, arrivee) {
  const url = [
    'https://router.project-osrm.org/route/v1/driving/',
    `${depart.lon},${depart.lat};${arrivee.lon},${arrivee.lat}`,
    '?geometries=geojson&overview=full',
  ].join('');

  const res  = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error('Impossible de calculer cet itinéraire.');

  // Retourne les coordonnées au format [[lon, lat], ...]
  return data.routes[0].geometry.coordinates;
}

/**
 * Calcule la distance en km entre deux points GPS (formule de Haversine).
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R  = 6371;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Distance minimale d'un point à un segment de droite [A, B].
 * Projection du point sur le segment, clampée entre A et B.
 * @returns {number} Distance en km
 */
function distancePointSegment(pLat, pLon, aLat, aLon, bLat, bLon) {
  const dx   = bLon - aLon;
  const dy   = bLat - aLat;
  const len2 = dx * dx + dy * dy;

  // Segment dégénéré (A = B) : distance simple
  if (len2 === 0) return haversine(pLat, pLon, aLat, aLon);

  // Paramètre t de la projection (entre 0 et 1 = sur le segment)
  const t = Math.max(0, Math.min(1, ((pLon - aLon) * dx + (pLat - aLat) * dy) / len2));

  // Point le plus proche sur le segment
  return haversine(pLat, pLon, aLat + t * dy, aLon + t * dx);
}

/**
 * Filtre les bornes dont la distance minimale au tracé est ≤ rayon.
 * On itère sur chaque segment de la polyline de la route.
 * @param {Array} bornes       - Tableau de bornes [{lat, lon, ...}]
 * @param {Array} routeCoords  - [[lon, lat], ...] retourné par OSRM
 * @param {number} rayon       - Rayon en km
 * @returns {Array} Bornes filtrées
 */
function filtrerBornesSurRoute(bornes, routeCoords, rayon) {
  return bornes.filter(b => {
    const lat = parseFloat(b.lat);
    const lon = parseFloat(b.lon);
    if (isNaN(lat) || isNaN(lon)) return false;

    // Dès qu'on trouve un segment proche, on inclut la borne
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

/**
 * Affiche le tracé de la route sur la carte + marqueurs départ/arrivée.
 * Supprime l'ancien tracé s'il existait.
 */
function afficherTrace(routeCoords, ptDepart, ptArrivee) {
  if (!carteLeaflet) initCarteLeaflet();

  // Supprimer l'ancien tracé
  if (routeLayerPolyline) carteLeaflet.removeLayer(routeLayerPolyline);

  // OSRM retourne [lon, lat] → Leaflet attend [lat, lon]
  const latlngs = routeCoords.map(([lon, lat]) => [lat, lon]);

  routeLayerPolyline = L.polyline(latlngs, {
    color:   '#e63946',
    weight:  5,
    opacity: 0.85,
  }).addTo(carteLeaflet);

  // Icônes colorées pour départ (vert) et arrivée (rouge)
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

  // Centrer la vue sur toute la route
  carteLeaflet.fitBounds(routeLayerPolyline.getBounds(), { padding: [40, 40] });
}

/**
 * Met à jour le message de statut dans le panneau.
 * @param {string} msg  - Message à afficher ('' pour effacer)
 * @param {string} type - 'loading' | 'error' | 'warn' | ''
 */
function setRouteStatus(msg, type = '') {
  const el = document.getElementById('route-status');
  el.textContent   = msg;
  el.className     = 'route-status ' + type;
}

/**
 * Affiche la liste des bornes trouvées dans le panneau.
 */
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

/**
 * Fonction principale déclenchée par le bouton "Trouver les bornes".
 * Enchaîne : géocodage → route OSRM → fetch bornes (bbox) → filtrage → affichage.
 */
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
    // ── Étape 1 : convertir les noms de ville en coordonnées GPS ──
    const ptDepart  = await geocoderVille(depart);
    const ptArrivee = await geocoderVille(arrivee);

    setRouteStatus('Calcul de l\'itinéraire…', 'loading');

    // ── Étape 2 : calculer le tracé via OSRM ──
    const routeCoords = await calculerRoute(ptDepart, ptArrivee);

    // ── Étape 3 : afficher le tracé sur la carte ──
    // Supprimer les anciens marqueurs avant de tracer la route
    carteLeaflet.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        carteLeaflet.removeLayer(layer);
      }
    });
    afficherTrace(routeCoords, ptDepart, ptArrivee);

    setRouteStatus('Chargement des bornes…', 'loading');

    // ── Étape 4 : bounding box du tracé + buffer de 0.15° (~15 km) ──
    // On récupère uniquement les bornes dans cette zone pour limiter
    // le volume de données envoyé par l'API.
    const lats   = routeCoords.map(c => c[1]);
    const lons   = routeCoords.map(c => c[0]);
    const buffer = 0.15; // ~15 km de marge
    const bbox   = [
      Math.min(...lons) - buffer,  // minLon
      Math.min(...lats) - buffer,  // minLat
      Math.max(...lons) + buffer,  // maxLon
      Math.max(...lats) + buffer,  // maxLat
    ].join(',');

    const res    = await fetch(`${API_BASE}/installations/carte?bbox=${bbox}`);
    const bornes = await res.json();

    // ── Étape 5 : filtrer les bornes réellement proches de la route ──
    const bornesFiltrees = filtrerBornesSurRoute(bornes, routeCoords, routeRayon);

    // ── Étape 6 : afficher les marqueurs sur la carte ──
    afficherMarqueurs(bornesFiltrees);
    document.getElementById('carte-count').textContent = bornesFiltrees.length;

    // ── Étape 7 : afficher la liste dans le panneau ──
    afficherResultatsRoute(bornesFiltrees);
    setRouteStatus('', '');

  } catch (err) {
    setRouteStatus('❌ ' + err.message, 'error');
  }
}

