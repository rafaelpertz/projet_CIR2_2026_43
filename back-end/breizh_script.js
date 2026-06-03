const pages = {
  accueil:      'breizh_accueil.html',
  liste:        'breizh_liste.html',
  creation:     'breizh_creation.html',
  modification: 'breizh_modification.html',
  detail:       'breizh_detail.html'
};

function show(name, id) {
  let url = pages[name];
  if (id != null) url += '?id=' + id;
  window.location.href = url;
}

(function () {
  const current = window.location.pathname.split('/').pop().split('?')[0];
  const pageMap = {
    'breizh_accueil.html':      'accueil',
    'breizh_liste.html':        'liste',
    'breizh_creation.html':     'creation',
    'breizh_modification.html': 'modification',
    'breizh_detail.html':       'detail'
  };
  const currentPage = pageMap[current];
  if (currentPage) {
    document.querySelectorAll('.demo-btn[data-page="' + currentPage + '"]').forEach(btn => {
      btn.classList.add('active');
    });
  }
})();
