/**
 * index.js — BreizhOhm · Page d'accueil
 * Groupe 43 · CIR2 · ISEN Ouest · 2026
 */

const API_BASE = 'api';

const DEPT_LABELS = {
  '22': '22 – Côtes-d\'Armor',
  '29': '29 – Finistère',
  '35': '35 – Ille-et-Vilaine',
  '56': '56 – Morbihan',
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'home') {
    loadStats();
  }
});

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

  const total = stats.total ?? 0;
  const elTotal = document.getElementById('stat-total');
  if (elTotal) elTotal.textContent = total.toLocaleString('fr-FR');

  const elTypes = document.getElementById('stat-types-prise');
  if (elTypes) elTypes.textContent = (stats.types_prise ?? []).length;

  const elAmen = document.getElementById('stat-amenageurs');
  if (elAmen) elAmen.textContent = (stats.amenageurs ?? 0).toLocaleString('fr-FR');

  const elDepts = document.getElementById('stat-depts');
  if (elDepts) elDepts.textContent = stats.departements ?? 0;

  buildYearChart(stats.par_annee  ?? []);
  buildDeptChart(stats.par_dept   ?? []);
  buildCrossTable(stats.croise    ?? []);
  buildConnectors(stats.types_prise ?? []);
}

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
