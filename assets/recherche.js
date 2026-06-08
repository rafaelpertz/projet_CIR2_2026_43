/**
 * recherche.js — BreizhOhm · Page Recherche
 * Groupe 43 · CIR2 · ISEN Ouest · 2026
 */

const API_BASE = 'api';

const DEPT_LABELS = {
  '22': '22 – Côtes-d\'Armor',
  '29': '29 – Finistère',
  '35': '35 – Ille-et-Vilaine',
  '56': '56 – Morbihan',
};

let detailMapLeaflet = null;

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'recherche') {
    chargerFiltresRecherche();
    const params = new URLSearchParams(window.location.search);
    const detailId = params.get('detail');
    if (detailId) {
      afficherDetail(parseInt(detailId));
    }
  }
});

/* ============================================================
   NAVIGATION ENTRE SOUS-VUES (search ↔ detail)
   ============================================================ */

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + name);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

/* ============================================================
   PEUPLEMENT DES <SELECT> VIA API
   ============================================================ */

async function chargerFiltresRecherche() {
  await chargerSelect('sel-amenageur', `${API_BASE}/amenageurs?limit=20&random=1`, 'nom_amenageur', 'id');
  await chargerSelect('sel-operateur', `${API_BASE}/operateurs`,                   'nom',           'id');
  await chargerSelect('sel-prise',     `${API_BASE}/types-prise`,                  'libelle',       'id');
  await chargerSelect('sel-dept',      `${API_BASE}/departements`,                 'nom',           'code');
  await chargerSelect('sel-acces',     `${API_BASE}/conditions-acces`,             'libelle',       'id');
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
   TABLEAU DE RÉSULTATS
   ============================================================ */

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
    if (!reponse.ok) {
      const corps = await reponse.text();
      throw new Error(`HTTP ${reponse.status} — ${corps}`);
    }
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

function afficherTableauResultats(installations) {
  const section = document.getElementById('results-section');
  const tbody   = document.getElementById('results-tbody');
  const countEl = document.getElementById('results-count');

  tbody.innerHTML = '';
  const total    = installations.length;
  const affichés = installations.slice(0, 20);
  countEl.textContent = total > 20
    ? `${total} résultats (20 affichés)`
    : `${total} résultat(s)`;

  affichés.forEach(inst => {
    const dateMES = formatDateMoisAnnee(inst.date_mise_en_service);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${dateMES}</td>
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

function formatDateMoisAnnee(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/* ============================================================
   DÉTAIL D'UNE INSTALLATION
   ============================================================ */

async function afficherDetail(id) {
  try {
    const reponse = await fetch(`${API_BASE}/installations/${id}`);
    if (!reponse.ok) {
      const corps = await reponse.text();
      throw new Error(`HTTP ${reponse.status} — ${corps}`);
    }
    const inst = await reponse.json();
    remplirPageDetail(inst);
  } catch (err) {
    console.error('Erreur chargement détail :', err);
    document.getElementById('dp-title').textContent = '⚠ Erreur de chargement';
  }
  showPage('detail');
}

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
  setText('dp-dept',        inst.code_dept ? (DEPT_LABELS[String(inst.code_dept)] || inst.code_dept + ' – ' + (inst.nom_dept || '')) : '—');
  setText('dp-coords',      inst.coordonneesXY_lat ? `${inst.coordonneesXY_lat}, ${inst.coordonneesXY_lon}` : '—');

  const lat = parseFloat(inst.coordonneesXY_lat);
  const lon = parseFloat(inst.coordonneesXY_lon);
  if (!isNaN(lat) && !isNaN(lon)) {
    setTimeout(() => initDetailMap(lat, lon, inst.nom_enseigne || inst.nom_amenageur || ''), 100);
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

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
  setTimeout(() => detailMapLeaflet && detailMapLeaflet.invalidateSize(), 150);
}
