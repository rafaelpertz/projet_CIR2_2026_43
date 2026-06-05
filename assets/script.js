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
    loadStats();
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
   GRAPHIQUES DE LA PAGE D'ACCUEIL — données dynamiques via API
   ============================================================ */

/** Noms complets des départements bretons */
const DEPT_LABELS = {
  '22': '22 – Côtes-d\'Armor',
  '29': '29 – Finistère',
  '35': '35 – Ille-et-Vilaine',
  '56': '56 – Morbihan',
};

/**
 * Charge les stats depuis l'API et met à jour tous les éléments
 * de la page d'accueil (cartes, graphiques, tableau, connecteurs).
 */
async function loadStats() {
  let stats;
  try {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    stats = await res.json();
  } catch (err) {
    console.error('Erreur chargement stats :', err);
    return;
  }

  // ── Cartes chiffres ──────────────────────────────────────────
  const total = stats.total ?? 0;
  const elTotal = document.getElementById('stat-total');
  if (elTotal) elTotal.textContent = total.toLocaleString('fr-FR');

  const elPdc = document.getElementById('stat-pdc');
  if (elPdc) elPdc.textContent = total.toLocaleString('fr-FR');

  const elAmen = document.getElementById('stat-amenageurs');
  if (elAmen) elAmen.textContent = (stats.amenageurs ?? 0).toLocaleString('fr-FR');

  const elDepts = document.getElementById('stat-depts');
  if (elDepts) elDepts.textContent = stats.departements ?? 0;

  // ── Graphiques ───────────────────────────────────────────────
  buildYearChart(stats.par_annee  ?? []);
  buildDeptChart(stats.par_dept   ?? []);
  buildCrossTable(stats.croise    ?? []);
  buildConnectors(stats.types_prise ?? []);
}

/**
 * Construit le graphique en barres "installations par année".
 * @param {Array<{annee:string|number, nb:number}>} data
 */
function buildYearChart(data) {
  const container = document.getElementById('year-chart');
  if (!container) return;
  container.innerHTML = '';
  const maxVal = Math.max(...data.map(d => +d.nb), 1);
  data.forEach(d => {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <span class="bar-label">${d.annee}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:0%" data-w="${(+d.nb / maxVal) * 100}%"></div>
      </div>
      <span class="bar-val">${(+d.nb).toLocaleString('fr-FR')}</span>`;
    container.appendChild(row);
  });
  setTimeout(() => {
    container.querySelectorAll('.bar-fill').forEach(b => { b.style.width = b.dataset.w; });
  }, 200);
}

/**
 * Construit le graphique en barres "répartition par département".
 * @param {Array<{code_dep:string, nb:number}>} data
 */
function buildDeptChart(data) {
  const container = document.getElementById('dept-chart');
  if (!container) return;
  container.innerHTML = '';
  const maxVal = Math.max(...data.map(d => +d.nb), 1);
  data.forEach(d => {
    const label = DEPT_LABELS[d.code_dep] ?? d.code_dep;
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <span class="bar-label-long">${label}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:0%" data-w="${(+d.nb / maxVal) * 100}%"></div>
      </div>
      <span class="bar-val">${(+d.nb).toLocaleString('fr-FR')}</span>`;
    container.appendChild(row);
  });
  setTimeout(() => {
    container.querySelectorAll('.bar-fill').forEach(b => { b.style.width = b.dataset.w; });
  }, 300);
}

/**
 * Remplit le tableau croisé année × département.
 * @param {Array<{annee:string|number, d22:number, d29:number, d35:number, d56:number}>} data
 */
function buildCrossTable(data) {
  const tbody = document.querySelector('#cross-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.annee}</td>
      <td>${(row.d29 ?? 0).toLocaleString('fr-FR')}</td>
      <td>${(row.d22 ?? 0).toLocaleString('fr-FR')}</td>
      <td>${(row.d56 ?? 0).toLocaleString('fr-FR')}</td>
      <td>${(row.d35 ?? 0).toLocaleString('fr-FR')}</td>`;
    tbody.appendChild(tr);
  });
}

/**
 * Construit dynamiquement les cartes "types de prise".
 * @param {Array<{type:string, nb:number, pct:number}>} data
 */
function buildConnectors(data) {
  const container = document.querySelector('.connectors');
  if (!container) return;
  container.innerHTML = '';
  const colors = ['', 'red', 'red', '', '', ''];
  data.forEach((d, i) => {
    const card = document.createElement('div');
    card.className = 'connector-card' + (colors[i] ? ' ' + colors[i] : '');
    card.innerHTML = `
      <div class="cn">${d.nb.toLocaleString('fr-FR')}</div>
      <div class="ct">${d.type}</div>
      <div class="cp">${d.pct} %</div>`;
    container.appendChild(card);
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

  detailMapLeaflet = L.map('dp-map-container', { minZoom: 10 }).setView([lat, lon], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(detailMapLeaflet);
  L.marker([lat, lon]).addTo(detailMapLeaflet).bindPopup(titre).openPopup();
}q

/* ============================================================
   FONCTIONNALITÉ 5 — CARTE OPENSTREETMAP / LEAFLET
   ============================================================ */

/** Initialise la carte Leaflet centrée sur la Bretagne. */
function initCarteLeaflet() {
  const container = document.getElementById('carte-leaflet-container');
  if (!container) return;

  carteLeaflet = L.map('carte-leaflet-container', { minZoom: 8 }).setView([48.15, -2.9], 8);
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

