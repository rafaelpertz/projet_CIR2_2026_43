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
 * Affiche la page demandée et cache les autres.
 * @param {string} name - Identifiant de la page (home, search, detail, carte)
 */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + name);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }

  // Initialiser la carte Leaflet au premier affichage
  if (name === 'carte' && !carteLeaflet) {
    initCarteLeaflet();
  }
}

/* ============================================================
   INITIALISATION AU CHARGEMENT DE LA PAGE
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  buildYearChart();
  buildDeptChart();
  buildCrossTable();
  chargerFiltresRecherche();
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
 * Charge les options des selects du formulaire de recherche via l'API REST.
 * Routes attendues :
 *   GET /api/amenageurs?limit=20&random=1   → [{id, nom_amenageur}, ...]
 *   GET /api/types-prise                    → [{id, libelle}, ...]
 *   GET /api/departements                   → [{code, nom}, ...]
 */
async function chargerFiltresRecherche() {
  await chargerSelect('sel-amenageur', `${API_BASE}/amenageurs?limit=20&random=1`, 'nom_amenageur', 'id');
  await chargerSelect('sel-prise',     `${API_BASE}/types-prise`,                  'libelle',        'id');
  await chargerSelect('sel-dept',      `${API_BASE}/departements`,                 'nom',            'code');
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
  const amenageur = document.getElementById('sel-amenageur').value;
  const prise     = document.getElementById('sel-prise').value;
  const dept      = document.getElementById('sel-dept').value;

  const params = new URLSearchParams();
  if (amenageur) params.append('amenageur', amenageur);
  if (prise)     params.append('prise', prise);
  if (dept)      params.append('dept', dept);

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

  const annee = document.getElementById('carte-annee').value;
  const dept  = document.getElementById('carte-dept').value;

  const params = new URLSearchParams();
  if (annee) params.append('annee', annee);
  if (dept)  params.append('dept', dept);

  try {
    const reponse = await fetch(`${API_BASE}/installations/carte?${params.toString()}`);
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    const points = await reponse.json();
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

  points.forEach(pt => {
    const lat = parseFloat(pt.lat);
    const lon = parseFloat(pt.lon);
    if (isNaN(lat) || isNaN(lon)) return;

    // Popup : localité, puissance et lien vers détail
    const popupHtml = `
      <div style="font-family:sans-serif;min-width:160px;">
        <strong>${pt.commune || '—'}</strong><br>
        Puissance : ${pt.puissance_nominale ? pt.puissance_nominale + ' kW' : '—'}<br>
        Type : ${pt.type_prise || '—'}<br>
        <a href="#" onclick="afficherDetail(${pt.id});return false;"
           style="color:#e63946;font-weight:bold;">Voir le détail →</a>
      </div>`;

    L.marker([lat, lon]).addTo(carteLeaflet).bindPopup(popupHtml);
  });
}

