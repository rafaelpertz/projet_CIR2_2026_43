// ===== NAVIGATION =====
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  window.scrollTo(0, 0);
}

// ===== BUILD YEAR CHART =====
const yearData = [
  {y:'2014',v:4},{y:'2015',v:13},{y:'2016',v:273},{y:'2017',v:279},
  {y:'2018',v:36},{y:'2019',v:56},{y:'2020',v:25},{y:'2021',v:107},
  {y:'2022',v:388},{y:'2023',v:945},{y:'2024',v:623},{y:'2025',v:545},{y:'2026',v:21}
];
const maxYear = Math.max(...yearData.map(d=>d.v));
const yearContainer = document.getElementById('year-chart');
yearData.forEach(d => {
  const row = document.createElement('div');
  row.className = 'bar-row';
  row.innerHTML = `
    <span class="bar-label">${d.y}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${(d.v/maxYear)*100}%"></div></div>
    <span class="bar-val">${d.v}</span>
  `;
  yearContainer.appendChild(row);
});

// ===== BUILD DEPT CHART =====
const deptData = [
  {label:'35 – Ille-et-Vilaine', v:1437},
  {label:'56 – Morbihan', v:1318},
  {label:'29 – Finistère', v:698},
  {label:'22 – Côtes-d\'Armor', v:644},
];
const maxDept = Math.max(...deptData.map(d=>d.v));
const deptContainer = document.getElementById('dept-chart');
deptData.forEach(d => {
  const row = document.createElement('div');
  row.className = 'bar-row';
  row.innerHTML = `
    <span class="bar-label-long">${d.label}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${(d.v/maxDept)*100}%"></div></div>
    <span class="bar-val">${d.v}</span>
  `;
  deptContainer.appendChild(row);
});

// ===== FILTER SELECTION =====
function toggleFilter(el) {
  el.classList.toggle('selected');
  updateCount();
}

function updateCount() {
  const selected = document.querySelectorAll('.criteria-table li.selected').length;
  const base = 564;
  const newCount = Math.max(12, base - selected * Math.floor(Math.random()*80 + 30));
  document.getElementById('result-count').textContent = newCount.toLocaleString('fr-FR');
}

function validateSearch() {
  document.getElementById('map-section').scrollIntoView({behavior:'smooth'});
  updateCount();
}

// ===== STATION DETAIL =====
function showStation(name, addr, date, power, slots, link, mx, my) {
  document.getElementById('detail-name').textContent = 'Borne "' + name + '"';
  document.getElementById('detail-date').textContent = date;
  document.getElementById('detail-addr').textContent = addr;
  document.getElementById('detail-power').textContent = power;
  document.getElementById('detail-slots').textContent = slots;
  const linkEl = document.getElementById('detail-link');
  linkEl.textContent = link;
  linkEl.href = link.startsWith('http') ? link : '#';

  // Update detail map with a pin
  const svg = document.getElementById('detail-map-svg');
  // Remove old pins
  svg.querySelectorAll('.dpin').forEach(e => e.remove());
  // Scale mx,my from main map coords (800x450) to detail map (400x260)
  const dx = (mx / 800) * 400;
  const dy = (my / 450) * 260;
  const pin = document.createElementNS('http://www.w3.org/2000/svg','g');
  pin.setAttribute('class','dpin');
  pin.innerHTML = `
    <circle cx="${dx}" cy="${dy}" r="8" fill="#e63946" stroke="#fff" stroke-width="2"/>
    <circle cx="${dx}" cy="${dy-9}" r="2.5" fill="#fff"/>
    <line x1="${dx}" y1="${dy-6}" x2="${dx}" y2="${dy+8}" stroke="#fff" stroke-width="1.5"/>
  `;
  svg.appendChild(pin);

  const detail = document.getElementById('detail-section');
  detail.classList.add('visible');
  setTimeout(() => detail.scrollIntoView({behavior:'smooth'}), 50);
}

// Animate bars on load
setTimeout(() => {
  document.querySelectorAll('.bar-fill').forEach(b => {
    const w = b.style.width;
    b.style.width = '0';
    setTimeout(() => b.style.width = w, 100);
  });
}, 200);