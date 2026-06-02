const pages = {
  accueil:      'page1.html',
  liste:        'page2.html',
  creation:     'page3.html',
  modification: 'page4.html',
  detail:       'page5.html'
};

function showPage(name) {
  window.location.href = pages[name];
}

// Mark the active demo-nav button based on the current file
(function () {
  const current = window.location.pathname.split('/').pop();
  document.querySelectorAll('.demo-btn').forEach(btn => {
    const target = Object.entries(pages).find(([, file]) => file === current);
    if (!target) return;
    const keywords = {
      accueil:      'accueil',
      liste:        'liste',
      creation:     'création',
      modification: 'modification',
      detail:       'détail'
    };
    if (btn.textContent.toLowerCase().includes(keywords[target[0]])) {
      btn.classList.add('active');
    }
  });
})();
