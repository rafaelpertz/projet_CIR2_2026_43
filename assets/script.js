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

/**
 * Chemin de base pour tous les appels API REST.
 * Étant donné que l'API est servie par le même serveur que le front-end,
 * on utilise un chemin relatif ('api') plutôt qu'une URL absolue.
 * Cela permet au projet de fonctionner aussi bien avec un vhost Apache
 * (http://breizohm.local/) que dans un sous-dossier (http://localhost/projet/).
 */
const API_BASE = 'api';

/* ============================================================
   NAVIGATION ENTRE PAGES
   ============================================================ */

/**
 * Variable globale stockant l'instance Leaflet de la page "carte".
 * Elle est déclarée ici (au niveau module) pour pouvoir être
 * réutilisée et détruite proprement lors d'une réinitialisation.
 * Initialisée à null tant que la page carte n'a pas été chargée.
 */
let carteLeaflet = null;

/**
 * Variable globale stockant l'instance Leaflet de la mini-carte
 * présente sur la page "détail d'une installation".
 * Séparée de carteLeaflet car les deux cartes peuvent coexister
 * dans des pages HTML différentes.
 */
let detailMapLeaflet = null;

/**
 * Bascule entre les sous-vues d'une même page HTML.
 *
 * Cette fonction implémente un système de navigation SPA (Single Page Application)
 * léger : plusieurs sections <div class="page" id="page-XXX"> coexistent dans
 * le même fichier HTML, mais une seule est visible à la fois grâce à la classe
 * CSS "active". Cela évite un rechargement de page complet pour passer de la
 * liste de résultats au détail d'une installation.
 *
 * Méthodes utilisées :
 *  - document.querySelectorAll('.page') : sélectionne TOUS les éléments portant
 *    la classe "page" et retourne une NodeList.
 *  - NodeList.forEach() : itère sur chaque élément trouvé.
 *  - element.classList.remove('active') : retire la classe "active" de chaque
 *    page pour les masquer toutes avant d'en activer une seule.
 *  - document.getElementById('page-' + name) : cible la vue demandée par son ID.
 *  - element.classList.add('active') : rend la vue cible visible (le CSS
 *    applique display:block ou équivalent sur .page.active).
 *  - window.scrollTo(0, 0) : replace le scroll en haut de la fenêtre pour que
 *    l'utilisateur ne se retrouve pas au milieu de la page après la transition.
 *
 * @param {string} name - Identifiant de la vue à afficher (ex: 'search', 'detail')
 */
function showPage(name) {
  // On cache toutes les pages en retirant la classe "active"
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // On récupère l'élément HTML correspondant à la page demandée
  const target = document.getElementById('page-' + name);

  if (target) {
    // On rend la page cible visible
    target.classList.add('active');
    // On remonte le scroll tout en haut pour un affichage propre
    window.scrollTo(0, 0);
  }
}

/* ============================================================
   INITIALISATION AU CHARGEMENT DE LA PAGE
   ============================================================ */

/**
 * Point d'entrée principal : s'exécute une seule fois, dès que le DOM
 * est entièrement construit par le navigateur (mais avant que les images
 * et les ressources externes soient chargées).
 *
 * Méthodes utilisées :
 *  - document.addEventListener('DOMContentLoaded', callback) : enregistre
 *    une fonction qui sera appelée quand le DOM est prêt. C'est l'équivalent
 *    moderne de window.onload mais plus rapide car il n'attend pas les images.
 *  - document.body.dataset.page : lit l'attribut data-page="xxx" posé sur
 *    la balise <body> dans chaque fichier HTML. Cela permet à ce script
 *    unique de savoir sur quelle page il tourne (home, recherche, carte…).
 *  - new URLSearchParams(window.location.search) : analyse la query string
 *    de l'URL courante (ex: ?detail=42) pour en extraire les paramètres.
 *  - params.get('detail') : récupère la valeur du paramètre "detail" dans
 *    l'URL. Retourne null si le paramètre est absent.
 *  - parseInt() : convertit la chaîne de caractères retournée par params.get
 *    en nombre entier pour l'utiliser comme identifiant.
 */
document.addEventListener('DOMContentLoaded', () => {
  // On lit l'attribut data-page du <body> pour détecter la page courante
  const page = document.body.dataset.page;

  // Page d'accueil : on charge les statistiques et les graphiques
  if (page === 'home') {
    loadStats();
  }

  // Page de recherche : on remplit les filtres et on vérifie si
  // l'URL contient un paramètre "?detail=id" (redirection depuis la carte)
  if (page === 'recherche') {
    chargerFiltresRecherche();

    // Analyse de la query string de l'URL courante
    const params = new URLSearchParams(window.location.search);
    const detailId = params.get('detail'); // ex: "42" ou null

    if (detailId) {
      // Si un ID est présent dans l'URL, on affiche directement le détail
      // sans que l'utilisateur ait à faire une recherche manuelle
      afficherDetail(parseInt(detailId));
    }
  }

  // Page carte : on remplit les filtres et on initialise la carte Leaflet
  if (page === 'carte') {
    chargerFiltresCarte();
    initCarteLeaflet();
  }
});

/* ============================================================
   GRAPHIQUES DE LA PAGE D'ACCUEIL — données dynamiques via API
   ============================================================ */

/**
 * Dictionnaire de correspondance entre le code INSEE d'un département
 * breton et son nom complet affiché à l'utilisateur.
 * Déclaré en constante globale pour être réutilisé dans plusieurs fonctions
 * (graphiques, détail d'installation, tableau croisé…).
 */
const DEPT_LABELS = {
  '22': '22 – Côtes-d\'Armor',
  '29': '29 – Finistère',
  '35': '35 – Ille-et-Vilaine',
  '56': '56 – Morbihan',
};

/**
 * Charge les statistiques globales depuis l'API REST et orchestre
 * la mise à jour de tous les widgets de la page d'accueil.
 *
 * Cette fonction est "async" : elle retourne une Promise et peut utiliser
 * "await" pour attendre la résolution d'opérations asynchrones (appels réseau)
 * sans bloquer le thread principal du navigateur.
 *
 * Méthodes utilisées :
 *  - fetch(url) : API native du navigateur pour effectuer une requête HTTP GET.
 *    Retourne une Promise<Response> résolue dès que les en-têtes de la réponse
 *    sont reçus (pas forcément le corps complet).
 *  - await : suspend l'exécution de la fonction async jusqu'à la résolution
 *    de la Promise, sans bloquer le reste de l'application.
 *  - res.ok : booléen true si le code HTTP est entre 200 et 299.
 *  - res.json() : lit le corps de la réponse et le désérialise depuis JSON.
 *    Retourne elle-même une Promise qu'on attend avec await.
 *  - try/catch : gestion d'erreur pour les appels réseau : si fetch échoue
 *    (réseau indisponible, serveur en erreur…), l'exception est attrapée
 *    et logguée sans planter toute la page.
 *  - console.error() : affiche un message d'erreur dans la console du navigateur
 *    avec un style rouge, utile pour le débogage.
 *  - nullish coalescing (??) : si la valeur est null ou undefined, utilise
 *    la valeur par défaut à droite (ex: stats.total ?? 0 retourne 0 si
 *    stats.total est undefined).
 *  - Number.toLocaleString('fr-FR') : formate un nombre selon les conventions
 *    françaises (séparateur de milliers = espace, virgule décimale).
 */
async function loadStats() {
  let stats;

  try {
    // Envoi d'une requête GET vers /api/stats
    const res = await fetch(`${API_BASE}/stats`);

    // Si le serveur répond avec un code d'erreur (4xx, 5xx), on lève une exception
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Désérialisation du corps JSON de la réponse
    stats = await res.json();

  } catch (err) {
    // En cas d'erreur réseau ou serveur, on arrête sans crasher la page
    console.error('Erreur chargement stats :', err);
    return;
  }

  // ── Mise à jour des cartes "chiffres clés" ──────────────────────────────────

  // Nombre total d'installations (0 par défaut si la clé est absente)
  const total = stats.total ?? 0;
  const elTotal = document.getElementById('stat-total');
  // toLocaleString('fr-FR') formate ex: 12345 → "12 345"
  if (elTotal) elTotal.textContent = total.toLocaleString('fr-FR');

  // Nombre de types de prise distincts (longueur du tableau retourné)
  const elTypes = document.getElementById('stat-types-prise');
  if (elTypes) elTypes.textContent = (stats.types_prise ?? []).length;

  // Nombre d'aménageurs distincts
  const elAmen = document.getElementById('stat-amenageurs');
  if (elAmen) elAmen.textContent = (stats.amenageurs ?? 0).toLocaleString('fr-FR');

  // Nombre de départements couverts
  const elDepts = document.getElementById('stat-depts');
  if (elDepts) elDepts.textContent = stats.departements ?? 0;

  // ── Construction des graphiques et du tableau croisé ────────────────────────

  // Graphique barres : évolution annuelle du nombre d'installations
  buildYearChart(stats.par_annee  ?? []);

  // Graphique barres : répartition par département breton
  buildDeptChart(stats.par_dept   ?? []);

  // Tableau croisé année × département
  buildCrossTable(stats.croise    ?? []);

  // Cartes "types de connecteur" avec pourcentages
  buildConnectors(stats.types_prise ?? []);
}

/**
 * Construit le graphique en barres horizontales "Installations par année"
 * directement en HTML/CSS, sans bibliothèque externe de graphiques.
 *
 * Le principe : chaque barre est une div dont la largeur (en %) est calculée
 * proportionnellement à la valeur maximale. Une animation CSS est déclenchée
 * via setTimeout pour faire apparaître les barres progressivement.
 *
 * Méthodes utilisées :
 *  - document.getElementById() : cible le conteneur du graphique.
 *  - container.innerHTML = '' : vide le conteneur avant de le reconstruire
 *    (évite les doublons si la fonction est appelée plusieurs fois).
 *  - Math.max(...data.map(d => +d.nb), 1) : trouve la valeur maximale dans
 *    le tableau. L'opérateur spread (...) décompacte le tableau en arguments
 *    individuels pour Math.max. Le +d.nb convertit la chaîne en nombre.
 *    Le ", 1" garantit que maxVal n'est jamais 0 (évite la division par zéro).
 *  - Array.forEach() : itère sur chaque objet du tableau de données.
 *  - document.createElement('div') : crée un nouvel élément HTML en mémoire.
 *  - element.className : affecte la classe CSS de l'élément créé.
 *  - element.innerHTML : injecte du HTML dans l'élément (template literal).
 *  - container.appendChild(row) : insère l'élément dans le DOM, à la fin
 *    du conteneur.
 *  - data-w : attribut HTML personnalisé (data attribute) stockant la largeur
 *    cible de la barre. On ne l'applique pas immédiatement pour permettre
 *    l'animation CSS de transition.
 *  - setTimeout(callback, 200) : exécute le callback après 200 ms. Ce délai
 *    est nécessaire pour que le navigateur ait le temps de "peindre" les barres
 *    à 0% avant d'appliquer la largeur finale — sinon l'animation CSS n'est
 *    pas visible.
 *  - querySelectorAll('.bar-fill') : sélectionne toutes les barres du graphique
 *    pour leur appliquer en une seule itération la largeur finale.
 *
 * @param {Array<{annee:string|number, nb:number}>} data - Données par année
 */
function buildYearChart(data) {
  const container = document.getElementById('year-chart');
  if (!container) return; // Protection si l'élément est absent de la page

  // Vide le conteneur pour éviter les doublons
  container.innerHTML = '';

  // Valeur maximale pour normaliser les largeurs des barres (min 1 pour éviter /0)
  const maxVal = Math.max(...data.map(d => +d.nb), 1);

  data.forEach(d => {
    const row = document.createElement('div');
    row.className = 'bar-row';

    // On calcule le pourcentage de largeur et on le stocke dans data-w
    // La barre commence à 0% pour permettre l'animation CSS
    row.innerHTML = `
      <span class="bar-label">${d.annee}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:0%" data-w="${(+d.nb / maxVal) * 100}%"></div>
      </div>
      <span class="bar-val">${(+d.nb).toLocaleString('fr-FR')}</span>`;

    container.appendChild(row);
  });

  // Après 200ms, on applique la largeur finale à chaque barre pour déclencher
  // l'animation CSS de transition (la transition est définie dans le CSS)
  setTimeout(() => {
    container.querySelectorAll('.bar-fill').forEach(b => { b.style.width = b.dataset.w; });
  }, 200);
}

/**
 * Construit le graphique en barres horizontales "Répartition par département".
 * Même principe que buildYearChart, avec un délai légèrement plus long (300ms)
 * pour créer un effet de décalage visuel avec le premier graphique.
 *
 * Méthodes utilisées : identiques à buildYearChart.
 * Différence : utilisation de DEPT_LABELS pour afficher le nom complet
 * du département à la place du code brut.
 *  - DEPT_LABELS[d.code_dep] ?? d.code_dep : si le code est dans le
 *    dictionnaire, on affiche le label complet ; sinon on affiche le code brut.
 *
 * @param {Array<{code_dep:string, nb:number}>} data - Données par département
 */
function buildDeptChart(data) {
  const container = document.getElementById('dept-chart');
  if (!container) return;

  container.innerHTML = '';

  const maxVal = Math.max(...data.map(d => +d.nb), 1);

  data.forEach(d => {
    // Résolution du label complet via le dictionnaire DEPT_LABELS
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

  // Délai légèrement plus long pour un effet de cascade visuel
  setTimeout(() => {
    container.querySelectorAll('.bar-fill').forEach(b => { b.style.width = b.dataset.w; });
  }, 300);
}

/**
 * Remplit dynamiquement le tableau croisé "Année × Département".
 * Ce tableau permet de visualiser la progression des installations
 * par année ET par département simultanément.
 *
 * Méthodes utilisées :
 *  - document.querySelector('#cross-table tbody') : sélectionne le <tbody>
 *    du tableau HTML existant dans le DOM (le <thead> est défini en dur dans
 *    le HTML et n'est pas touché).
 *  - tbody.innerHTML = '' : vide uniquement le corps du tableau.
 *  - document.createElement('tr') : crée une ligne de tableau.
 *  - tr.innerHTML : injecte les cellules <td> avec les données.
 *  - Number.toLocaleString('fr-FR') : formate les nombres à la française.
 *  - (row.d29 ?? 0) : si la clé est absente dans l'objet (département sans
 *    données pour cette année), on affiche 0.
 *  - tbody.appendChild(tr) : insère la ligne dans le tableau.
 *
 * @param {Array<{annee:string|number, d22:number, d29:number, d35:number, d56:number}>} data
 */
function buildCrossTable(data) {
  // Cible uniquement le <tbody> pour ne pas écraser les en-têtes du tableau
  const tbody = document.querySelector('#cross-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  data.forEach(row => {
    const tr = document.createElement('tr');
    // Les colonnes sont dans l'ordre géographique : 29, 22, 56, 35
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
 * Construit dynamiquement les cartes "Types de connecteur" de la page d'accueil.
 * Chaque carte affiche : le nombre d'installations, le type de prise, et le %.
 *
 * Méthodes utilisées :
 *  - document.querySelector('.connectors') : sélectionne le conteneur flex
 *    des cartes connecteurs.
 *  - container.innerHTML = '' : vide le conteneur avant reconstruction.
 *  - document.createElement('div') : crée une carte.
 *  - card.className : on ajoute une classe CSS conditionnelle ('red') pour
 *    certains types de prise selon leur index dans le tableau.
 *  - Number.toLocaleString('fr-FR') : formate les nombres.
 *  - container.appendChild(card) : insère chaque carte dans le conteneur.
 *
 * @param {Array<{type:string, nb:number, pct:number}>} data - Types de prise
 */
function buildConnectors(data) {
  const container = document.querySelector('.connectors');
  if (!container) return;

  container.innerHTML = '';

  // Tableau de couleurs par index : certaines cartes ont la classe 'red'
  // pour une mise en avant visuelle selon la charte graphique du projet
  const colors = ['', 'red', 'red', '', '', ''];

  data.forEach((d, i) => {
    const card = document.createElement('div');
    // Ajout conditionnel de la classe 'red' selon l'index du connecteur
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
 * Orchestre le chargement de tous les filtres <select> de la page de recherche.
 * Chaque appel à chargerSelect déclenche une requête HTTP vers un endpoint
 * différent de l'API REST pour récupérer les valeurs disponibles.
 *
 * Le mot-clé "await" est utilisé pour que les selects se chargent séquentiellement
 * (même si le chargement en parallèle serait possible avec Promise.all,
 * l'ordre séquentiel garantit un comportement prévisible).
 *
 * Paramètres passés à chargerSelect :
 *  - ID du <select> dans le DOM
 *  - URL de l'API à appeler
 *  - Clé JSON utilisée comme texte affiché (label) dans l'option
 *  - Clé JSON utilisée comme valeur (value) de l'option
 *
 * Le paramètre "?limit=20&random=1" sur l'endpoint amenageurs permet
 * de limiter à 20 résultats tirés aléatoirement pour ne pas surcharger
 * la liste déroulante avec des centaines d'entrées.
 */
async function chargerFiltresRecherche() {
  await chargerSelect('sel-amenageur', `${API_BASE}/amenageurs?limit=20&random=1`, 'nom_amenageur', 'id');
  await chargerSelect('sel-operateur', `${API_BASE}/operateurs`,                   'nom',           'id');
  await chargerSelect('sel-prise',     `${API_BASE}/types-prise`,                  'libelle',       'id');
  await chargerSelect('sel-dept',      `${API_BASE}/departements`,                 'nom',           'code');
  await chargerSelect('sel-acces',     `${API_BASE}/conditions-acces`,             'libelle',       'id');
}

/**
 * Orchestre le chargement des filtres <select> de la page carte.
 * Seuls deux filtres sont nécessaires sur la carte (type de prise et aménageur).
 */
async function chargerFiltresCarte() {
  await chargerSelect('carte-prise',     `${API_BASE}/types-prise`,                  'libelle',       'id');
  await chargerSelect('carte-amenageur', `${API_BASE}/amenageurs?limit=20&random=1`, 'nom_amenageur', 'id');
}

/**
 * Fonction générique qui remplit un <select> HTML avec les données
 * retournées par un endpoint de l'API REST.
 *
 * Cette fonction est réutilisable pour n'importe quel select/endpoint :
 * il suffit de lui passer les noms des clés JSON à utiliser comme
 * label et valeur des options.
 *
 * Méthodes utilisées :
 *  - document.getElementById(selectId) : récupère l'élément <select> cible.
 *  - fetch(url) : requête HTTP GET vers l'API.
 *  - await res.text() : lit le corps de la réponse en tant que texte brut,
 *    utile pour afficher le message d'erreur du serveur en cas d'échec.
 *  - await reponse.json() : désérialise le JSON retourné par l'API.
 *  - Array.forEach() : itère sur chaque objet retourné par l'API.
 *  - document.createElement('option') : crée une option HTML.
 *  - opt.value : valeur envoyée au serveur lors de la soumission du formulaire.
 *  - opt.textContent : texte affiché à l'utilisateur dans la liste déroulante.
 *  - item[valueKey] ?? '' : accès dynamique à une propriété d'objet par son
 *    nom (notation crochet). Si la clé est absente, la valeur est une chaîne vide.
 *  - sel.appendChild(opt) : insère l'option dans le select.
 *  - opt.disabled = true : rend l'option non sélectionnable (utilisée pour
 *    afficher un message d'erreur en cas d'échec du chargement).
 *  - console.error() : log l'erreur dans la console développeur.
 *
 * @param {string} selectId  - ID de l'élément <select> à remplir
 * @param {string} url       - URL de l'API à appeler
 * @param {string} labelKey  - Nom de la propriété JSON à afficher comme texte
 * @param {string} valueKey  - Nom de la propriété JSON à utiliser comme valeur
 */
async function chargerSelect(selectId, url, labelKey, valueKey) {
  // On vérifie que l'élément existe dans le DOM avant de faire la requête
  const sel = document.getElementById(selectId);
  if (!sel) return;

  try {
    const reponse = await fetch(url);

    if (!reponse.ok) {
      // En cas d'erreur HTTP, on lit le corps pour inclure le message dans l'exception
      const corps = await reponse.text();
      throw new Error(`HTTP ${reponse.status} — ${corps}`);
    }

    // Désérialisation du tableau JSON retourné par l'API
    const donnees = await reponse.json();

    // Création et insertion d'une <option> pour chaque élément retourné
    donnees.forEach(item => {
      const opt = document.createElement('option');
      // Accès dynamique aux propriétés : item['nom_amenageur'] ou item['id']
      opt.value = item[valueKey] ?? '';
      opt.textContent = item[labelKey] ?? '—';
      sel.appendChild(opt);
    });

  } catch (err) {
    console.error(`Erreur chargement filtre (${url}) :`, err);

    // En cas d'erreur, on insère une option désactivée pour informer l'utilisateur
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
 * Déclenche la recherche d'installations en construisant une requête HTTP
 * avec les filtres sélectionnés par l'utilisateur dans le formulaire.
 *
 * Les résultats s'affichent sous le formulaire sans rechargement de page,
 * en utilisant la manipulation directe du DOM (afficherTableauResultats).
 *
 * Route appelée : GET /api/installations?nom=&amenageur=&operateur=&prise=&dept=&puissance_min=&acces=&gratuit=
 *
 * Méthodes utilisées :
 *  - document.getElementById().value : lit la valeur actuelle d'un champ
 *    de formulaire (input, select).
 *  - String.trim() : supprime les espaces en début et fin de chaîne pour
 *    ne pas envoyer de filtre vide avec des espaces.
 *  - new URLSearchParams() : crée un objet permettant de construire une
 *    query string URL de manière sûre (encode automatiquement les caractères
 *    spéciaux comme les accents, les espaces, etc.).
 *  - params.append(clé, valeur) : ajoute un paramètre à la query string.
 *    On n'ajoute le paramètre QUE si l'utilisateur a sélectionné une valeur
 *    (if (amenageur)) pour ne pas envoyer de filtres vides au serveur.
 *  - params.toString() : sérialise les paramètres en query string (ex: "dept=29&prise=2").
 *  - fetch(url) : envoi de la requête GET vers l'API.
 *  - await reponse.json() : désérialisation du tableau de résultats.
 *  - afficherTableauResultats([]) : appelé avec un tableau vide en cas d'erreur
 *    pour réinitialiser proprement l'affichage.
 *  - element.textContent : modifie le texte affiché dans un élément HTML.
 *  - element.style.display = 'block' : rend visible la section des résultats.
 */
async function lancerRecherche() {
  // Lecture de la valeur de chaque filtre du formulaire
  const nom          = document.getElementById('sel-nom').value.trim();
  const amenageur    = document.getElementById('sel-amenageur').value;
  const operateur    = document.getElementById('sel-operateur').value;
  const prise        = document.getElementById('sel-prise').value;
  const dept         = document.getElementById('sel-dept').value;
  const puissanceMin = document.getElementById('sel-puissance-min').value;
  const acces        = document.getElementById('sel-acces').value;
  const gratuit      = document.getElementById('sel-gratuit').value;

  // Construction sécurisée de la query string avec URLSearchParams
  // (évite l'injection et encode automatiquement les caractères spéciaux)
  const params = new URLSearchParams();
  if (nom)          params.append('nom', nom);
  if (amenageur)    params.append('amenageur', amenageur);
  if (operateur)    params.append('operateur', operateur);
  if (prise)        params.append('prise', prise);
  if (dept)         params.append('dept', dept);
  if (puissanceMin) params.append('puissance_min', puissanceMin);
  if (acces)        params.append('acces', acces);
  // Cas spécial : 'gratuit' peut valoir '0' (falsy) donc on vérifie !== ''
  if (gratuit !== '') params.append('gratuit', gratuit);

  // Assemblage de l'URL complète avec les paramètres de filtre
  const url = `${API_BASE}/installations?${params.toString()}`;

  try {
    const reponse = await fetch(url);

    if (!reponse.ok) {
      const corps = await reponse.text();
      throw new Error(`HTTP ${reponse.status} — ${corps}`);
    }

    const donnees = await reponse.json();
    // Transmission du tableau de résultats à la fonction d'affichage
    afficherTableauResultats(donnees);

  } catch (err) {
    console.error('Erreur recherche :', err);

    // En cas d'erreur, on affiche le tableau vide avec un message d'erreur
    afficherTableauResultats([]);
    const section = document.getElementById('results-section');
    const count   = document.getElementById('results-count');
    if (count) count.textContent = '⚠ Erreur de connexion à la base de données';
    if (section) section.style.display = 'block';
  }
}

/**
 * Construit et affiche le tableau HTML des résultats de recherche.
 * Limite l'affichage à 20 lignes maximum pour des raisons de performance
 * (évite de générer des centaines de lignes DOM).
 *
 * Méthodes utilisées :
 *  - document.getElementById() : récupère les éléments DOM du tableau.
 *  - tbody.innerHTML = '' : vide le tableau avant de le repeupler pour
 *    éviter que les anciens résultats s'accumulent.
 *  - Array.length : nombre total de résultats retournés par l'API.
 *  - Array.slice(0, 20) : extrait les 20 premiers éléments du tableau
 *    sans modifier le tableau original (retourne un nouveau tableau).
 *  - Ternaire (condition ? a : b) : choisit le texte du compteur selon
 *    si tous les résultats sont affichés ou non.
 *  - Array.forEach() : itère sur les 20 premières installations.
 *  - formatDateMoisAnnee() : formate la date de mise en service.
 *  - document.createElement('tr') : crée une ligne de tableau.
 *  - tr.innerHTML : injecte les cellules avec les données de l'installation.
 *  - Nullish coalescing (??) et OR (||) : valeurs par défaut si une propriété
 *    est absente ou nulle dans l'objet JSON.
 *  - onclick="afficherDetail(id)" : gestionnaire d'événement inline sur le
 *    bouton "Voir le détail" de chaque ligne.
 *  - tbody.appendChild(tr) : insère la ligne dans le tableau HTML.
 *  - section.style.display = 'block' : rend visible la section résultats.
 *  - section.scrollIntoView({ behavior: 'smooth' }) : fait défiler la page
 *    jusqu'au tableau de résultats avec une animation fluide.
 *
 * @param {Array} installations - Tableau d'objets installation retourné par l'API
 */
function afficherTableauResultats(installations) {
  const section = document.getElementById('results-section');
  const tbody   = document.getElementById('results-tbody');
  const countEl = document.getElementById('results-count');

  // Réinitialisation du tableau
  tbody.innerHTML = '';

  const total    = installations.length;
  // On n'affiche que les 20 premiers résultats pour des raisons de performance
  const affichés = installations.slice(0, 20);

  // Message de comptage adaptatif
  countEl.textContent = total > 20
    ? `${total} résultats (20 affichés)`
    : `${total} résultat(s)`;

  affichés.forEach(inst => {
    // Formatage de la date en "MM/YYYY" via la fonction utilitaire dédiée
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

  // On rend la section visible et on fait défiler la page jusqu'à elle
  section.style.display = 'block';
  // scrollIntoView() fait défiler la page pour que l'élément soit visible
  // L'option { behavior: 'smooth' } active l'animation de défilement fluide
  section.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Formate une date ISO 8601 (ex: "2022-06-15T00:00:00") en chaîne "MM/YYYY".
 * On n'affiche que le mois et l'année car le jour exact est souvent inconnu
 * pour les données de mise en service des bornes.
 *
 * Méthodes utilisées :
 *  - new Date(dateStr) : crée un objet Date JavaScript depuis une chaîne ISO.
 *    Si la chaîne est invalide, l'objet Date retourne NaN pour ses méthodes.
 *  - isNaN(d) : vérifie si l'objet Date est invalide (NaN = "Not a Number").
 *    Si invalide, on retourne la chaîne brute plutôt que de planter.
 *  - d.getMonth() : retourne le mois (0 = janvier, 11 = décembre), donc on
 *    ajoute +1 pour obtenir le mois calendaire (1-12).
 *  - d.getFullYear() : retourne l'année sur 4 chiffres.
 *  - String.padStart(2, '0') : complète la chaîne avec des zéros à gauche
 *    pour obtenir toujours 2 chiffres (ex: "6" → "06").
 *  - Template literal : construit la chaîne finale "MM/YYYY".
 *
 * @param {string} dateStr - Date au format ISO ou null/undefined
 * @returns {string} Date formatée "MM/YYYY" ou "—" si absente/invalide
 */
function formatDateMoisAnnee(dateStr) {
  if (!dateStr) return '—'; // Cas null, undefined, chaîne vide

  const d = new Date(dateStr); // Parsing de la date ISO

  // Si le parsing échoue (date malformée), on retourne la chaîne brute
  if (isNaN(d)) return dateStr;

  // Formatage MM/YYYY avec padding à 2 chiffres pour le mois
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/* ============================================================
   FONCTIONNALITÉ 4 — DÉTAIL D'UNE INSTALLATION
   ============================================================ */

/**
 * Charge les données complètes d'une installation via l'API REST
 * et affiche la page de détail correspondante.
 *
 * Route appelée : GET /api/installations/{id}
 *
 * Cette fonction combine un appel API asynchrone et une transition
 * de vue (showPage). La vue "detail" est affichée même en cas d'erreur
 * afin que l'utilisateur voie le message d'erreur (plutôt que rien).
 *
 * Méthodes utilisées :
 *  - fetch(`${API_BASE}/installations/${id}`) : requête GET vers l'endpoint
 *    de détail. L'ID est interpolé directement dans l'URL.
 *  - await reponse.json() : désérialisation de l'objet installation retourné.
 *  - remplirPageDetail(inst) : délègue le remplissage des champs à une
 *    fonction dédiée pour séparer les responsabilités.
 *  - showPage('detail') : bascule vers la vue détail (dans le bloc finally
 *    implicite : appelé toujours, erreur ou non).
 *  - document.getElementById('dp-title').textContent : affiche un message
 *    d'erreur dans le titre de la page en cas d'échec.
 *
 * @param {number} id - Identifiant unique de l'installation dans la base
 */
async function afficherDetail(id) {
  try {
    const reponse = await fetch(`${API_BASE}/installations/${id}`);

    if (!reponse.ok) {
      const corps = await reponse.text();
      throw new Error(`HTTP ${reponse.status} — ${corps}`);
    }

    const inst = await reponse.json();
    // Délégation du remplissage des champs à une fonction dédiée
    remplirPageDetail(inst);

  } catch (err) {
    console.error('Erreur chargement détail :', err);
    // On affiche un message d'erreur dans le titre de la page
    document.getElementById('dp-title').textContent = '⚠ Erreur de chargement';
  }

  // On bascule vers la vue détail dans tous les cas (erreur ou succès)
  showPage('detail');
}

/**
 * Remplit tous les champs de la page détail avec les données d'une installation.
 * Utilise la fonction utilitaire setText() pour éviter la répétition du
 * pattern "getElementById + textContent".
 *
 * Méthodes utilisées :
 *  - setText(id, val) : fonction utilitaire locale qui appelle getElementById
 *    et affecte textContent (voir définition plus bas).
 *  - Opérateur logique OR (||) : choix du premier texte non-vide parmi
 *    plusieurs alternatives (ex: inst.nom_enseigne || inst.nom_amenageur || ...).
 *  - formatDateMoisAnnee() : formate la date de mise en service.
 *  - String(inst.code_dept) : conversion explicite en chaîne pour l'accès
 *    au dictionnaire DEPT_LABELS (les codes peuvent être stockés en entier).
 *  - parseFloat() : conversion de chaîne en nombre flottant pour les coordonnées GPS.
 *  - isNaN() : vérifie que les coordonnées sont numériquement valides avant
 *    d'initialiser la carte Leaflet.
 *  - setTimeout(() => initDetailMap(...), 100) : petit délai avant d'initialiser
 *    la mini-carte. Nécessaire car la page "detail" vient juste d'être rendue
 *    visible par showPage() — sans ce délai, le conteneur de la carte a une
 *    taille nulle et Leaflet ne peut pas calculer son rendu correctement.
 *
 * @param {Object} inst - Objet installation retourné par l'API
 */
function remplirPageDetail(inst) {
  // Titre de la page : on prend le premier libellé disponible dans l'ordre de préférence
  document.getElementById('dp-title').textContent =
    `Détail — ${inst.nom_enseigne || inst.nom_amenageur || 'Installation #' + inst.id}`;

  // Remplissage de chaque champ avec la fonction utilitaire setText
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

  // Construction du label département : code + nom (via DEPT_LABELS ou retour brut)
  setText('dp-dept', inst.code_dept
    ? (DEPT_LABELS[String(inst.code_dept)] || inst.code_dept + ' – ' + (inst.nom_dept || ''))
    : '—');

  // Affichage des coordonnées GPS formatées "lat, lon"
  setText('dp-coords', inst.coordonneesXY_lat
    ? `${inst.coordonneesXY_lat}, ${inst.coordonneesXY_lon}`
    : '—');

  // Initialisation de la mini-carte Leaflet si les coordonnées GPS sont valides
  const lat = parseFloat(inst.coordonneesXY_lat);
  const lon = parseFloat(inst.coordonneesXY_lon);

  if (!isNaN(lat) && !isNaN(lon)) {
    // Délai de 100ms pour que le DOM soit rendu avant l'initialisation de Leaflet
    setTimeout(() => initDetailMap(lat, lon, inst.nom_enseigne || inst.nom_amenageur || ''), 100);
  }
}

/**
 * Fonction utilitaire : remplit le textContent d'un élément par son ID.
 * Affiche "—" si la valeur est null, undefined ou absente.
 *
 * Méthodes utilisées :
 *  - document.getElementById(id) : récupère l'élément HTML cible.
 *  - el.textContent : propriété qui définit le contenu textuel d'un élément
 *    (contrairement à innerHTML, textContent est sûr car il n'interprète pas
 *    les balises HTML — pas de risque d'injection XSS).
 *  - val ?? '—' : si val est null ou undefined, affiche "—" comme placeholder.
 *
 * @param {string} id  - ID de l'élément HTML à remplir
 * @param {*}      val - Valeur à afficher (sera convertie en string par le navigateur)
 */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

/**
 * Initialise ou réinitialise la mini-carte Leaflet de la page détail.
 * Place un marqueur sur les coordonnées de l'installation avec une popup.
 *
 * Méthodes utilisées :
 *  - document.getElementById('dp-map-container') : récupère le conteneur
 *    HTML dans lequel Leaflet va créer sa carte.
 *  - detailMapLeaflet.remove() : détruit proprement l'instance Leaflet
 *    précédente (libère les event listeners et les ressources) avant d'en
 *    créer une nouvelle. Sans cette étape, Leaflet lèverait une erreur
 *    "Map container is already initialized".
 *  - L.map('dp-map-container', { minZoom: 10 }) : crée une carte Leaflet
 *    dans le conteneur HTML. Le paramètre minZoom empêche de dézoomer trop.
 *  - .setView([lat, lon], 15) : centre la carte sur les coordonnées et
 *    définit le niveau de zoom initial (15 = vue quartier).
 *  - L.tileLayer(url, options) : ajoute une couche de tuiles raster depuis
 *    OpenStreetMap. Les balises {s}, {z}, {x}, {y} sont remplacées par
 *    Leaflet (sous-domaine pour la répartition de charge, zoom, colonne, ligne).
 *  - .addTo(detailMapLeaflet) : attache la couche à la carte.
 *  - L.marker([lat, lon]) : crée un marqueur à la position GPS donnée.
 *  - .bindPopup(titre) : attache une popup affichant le nom de l'installation.
 *  - .openPopup() : ouvre automatiquement la popup au chargement.
 *  - setTimeout(() => detailMapLeaflet.invalidateSize(), 150) : force Leaflet
 *    à recalculer la taille de la carte après 150ms. Nécessaire quand le
 *    conteneur était caché au moment de l'initialisation (Leaflet ne peut
 *    pas détecter la taille d'un élément invisible).
 *
 * @param {number} lat   - Latitude GPS de l'installation
 * @param {number} lon   - Longitude GPS de l'installation
 * @param {string} titre - Nom affiché dans la popup du marqueur
 */
function initDetailMap(lat, lon, titre) {
  const container = document.getElementById('dp-map-container');
  if (!container) return;

  // Si une carte existe déjà, on la détruit proprement avant d'en créer une nouvelle
  if (detailMapLeaflet) {
    detailMapLeaflet.remove();
    detailMapLeaflet = null;
  }

  // Création de la carte Leaflet avec un zoom minimum de 10 (niveau département)
  detailMapLeaflet = L.map('dp-map-container', { minZoom: 10 }).setView([lat, lon], 15);

  // Ajout de la couche de tuiles OpenStreetMap (fond de carte)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19  // Zoom maximum supporté par les tuiles OSM
  }).addTo(detailMapLeaflet);

  // Ajout du marqueur avec popup ouverte au chargement
  L.marker([lat, lon]).addTo(detailMapLeaflet).bindPopup(titre).openPopup();

  // Recalcul de la taille si le conteneur était invisible lors de l'init
  setTimeout(() => detailMapLeaflet && detailMapLeaflet.invalidateSize(), 150);
}

/* ============================================================
   FONCTIONNALITÉ 5 — CARTE OPENSTREETMAP / LEAFLET
   ============================================================ */

/**
 * Initialise la carte Leaflet principale de la page "carte.html".
 * Centrée sur la Bretagne (48.15°N, 2.9°O) au zoom 8 (vue régionale).
 *
 * Méthodes utilisées :
 *  - document.getElementById('carte-leaflet-container') : vérifie que le
 *    conteneur existe dans le DOM avant d'initialiser Leaflet.
 *  - L.map(id, options) : crée la carte Leaflet dans le conteneur HTML.
 *    Le paramètre minZoom: 8 empêche de dézoomer hors de la région.
 *  - .setView([lat, lon], zoom) : centre et zoome la carte sur la Bretagne.
 *  - L.tileLayer(urlTemplate, options) : couche de tuiles OSM avec attribution
 *    obligatoire (licences ODbL/CC-BY-SA d'OpenStreetMap).
 *  - .addTo(carteLeaflet) : attache la couche à la carte globale.
 */
function initCarteLeaflet() {
  const container = document.getElementById('carte-leaflet-container');
  if (!container) return;

  // Initialisation de la carte Leaflet centrée sur la Bretagne
  // Coordonnées : centre géographique approximatif de la Bretagne
  carteLeaflet = L.map('carte-leaflet-container', { minZoom: 8 }).setView([48.15, -2.9], 8);

  // Couche de tuiles OSM (gratuite, sans clé API requise)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18  // Résolution maximale des tuiles disponibles
  }).addTo(carteLeaflet);
}

/**
 * Charge depuis l'API les bornes correspondant aux filtres de la carte
 * et les affiche comme marqueurs Leaflet.
 *
 * Route appelée : GET /api/installations/carte?annee=&dept=&prise=&amenageur=&puissance_min=
 *
 * Méthodes utilisées :
 *  - initCarteLeaflet() : sécurité — réinitialise la carte si elle n'existe pas.
 *  - document.getElementById().value.trim() : lecture + nettoyage des filtres.
 *  - new URLSearchParams() : construction sécurisée de la query string.
 *  - fetch() + await : requête HTTP asynchrone vers l'API.
 *  - await reponse.json() : désérialisation du tableau de points GPS.
 *  - afficherMarqueurs(points) : délègue l'affichage des marqueurs.
 *  - console.log(points) : log de débogage (à retirer en production).
 *  - document.getElementById('carte-count').textContent : affiche le nombre
 *    de résultats dans l'interface.
 */
async function afficherCarte() {
  // Sécurité : on s'assure que la carte est initialisée avant de placer des marqueurs
  if (!carteLeaflet) initCarteLeaflet();

  // Lecture des filtres du formulaire de la carte
  const nom         = document.getElementById('carte-nom').value.trim();
  const annee       = document.getElementById('carte-annee').value;
  const dept        = document.getElementById('carte-dept').value;
  const prise       = document.getElementById('carte-prise').value;
  const amenageur   = document.getElementById('carte-amenageur').value;
  const puissanceMin = document.getElementById('carte-puissance-min').value;

  // Construction de la query string avec URLSearchParams
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
    console.log(points); // Log de débogage — affiche les données reçues dans la console
    afficherMarqueurs(points); // Délégation du placement des marqueurs

  } catch (err) {
    console.error('Erreur chargement carte :', err);
    document.getElementById('carte-count').textContent = '⚠ Erreur';
  }
}

/**
 * Supprime les anciens marqueurs et place les nouveaux sur la carte Leaflet.
 * Au clic sur un marqueur, ouvre le panneau latéral détaillant les PDC
 * (Points De Charge) de la station.
 *
 * Méthodes utilisées :
 *  - carteLeaflet.eachLayer(callback) : itère sur TOUTES les couches de la
 *    carte (tuiles OSM, marqueurs, polylines…).
 *  - layer instanceof L.Marker : vérifie si la couche est un marqueur Leaflet
 *    (on n'efface pas les tuiles OSM ni les polylines d'itinéraire).
 *  - carteLeaflet.removeLayer(layer) : supprime proprement une couche de la carte.
 *  - document.getElementById('carte-count').textContent : mise à jour du compteur.
 *  - parseFloat() : conversion des coordonnées reçues en nombre flottant.
 *  - isNaN() : vérification de la validité des coordonnées GPS avant placement.
 *  - L.marker([lat, lon]).addTo(carteLeaflet) : création et ajout du marqueur.
 *  - marker.bindTooltip(texte, options) : attache une infobulle visible au survol.
 *    direction: 'top' positionne l'infobulle au-dessus, offset: [0, -8] l'écarte
 *    légèrement du marqueur.
 *  - marker.on('click', callback) : enregistre un écouteur sur le clic du marqueur.
 *    Quand l'utilisateur clique, on ouvre le panneau latéral avec les détails
 *    de la station.
 *
 * @param {Array} points - Tableau de points GPS [{lat, lon, commune, station_id}, ...]
 */
function afficherMarqueurs(points) {
  // Suppression de tous les anciens marqueurs (mais pas les tuiles OSM)
  carteLeaflet.eachLayer(layer => {
    if (layer instanceof L.Marker) carteLeaflet.removeLayer(layer);
  });

  // Mise à jour du compteur de résultats dans l'interface
  document.getElementById('carte-count').textContent = points.length;

  points.forEach(pt => {
    // Conversion et validation des coordonnées GPS
    const lat = parseFloat(pt.lat);
    const lon = parseFloat(pt.lon);
    if (isNaN(lat) || isNaN(lon)) return; // On ignore les points sans coordonnées valides

    // Création du marqueur et ajout à la carte
    const marker = L.marker([lat, lon]).addTo(carteLeaflet);

    // Infobulle affichée au survol du marqueur (nom de la commune)
    marker.bindTooltip(pt.commune || '—', { direction: 'top', offset: [0, -8] });

    // Au clic sur le marqueur, on ouvre le panneau latéral de la station
    marker.on('click', () => ouvrirPanelStation(pt.station_id, pt.commune, lat, lon));
  });
}


/* ================================================================
   FONCTIONNALITÉ ITINÉRAIRE
   Panneau coulissant + calcul de route OSRM + filtrage des bornes
   ================================================================

   APIs externes utilisées (gratuites, sans clé) :
     - Nominatim (OpenStreetMap) : géocodage — convertit un nom de ville
       en coordonnées GPS (latitude/longitude).
       URL : https://nominatim.openstreetmap.org/search
     - OSRM (Open Source Routing Machine) : calcul d'itinéraire routier
       entre deux points GPS. Retourne la polyline du trajet en GeoJSON.
       URL : https://router.project-osrm.org/route/v1/driving/
   ================================================================ */

/**
 * Polyline Leaflet représentant le tracé de l'itinéraire sur la carte.
 * Stockée globalement pour pouvoir la supprimer lors d'un nouveau calcul.
 */
let routeLayerPolyline = null;

/**
 * Rayon de recherche des bornes autour de l'itinéraire, en kilomètres.
 * Valeur par défaut : 10 km. Modifiable via les chips de l'interface.
 */
let routeRayon = 10;

/**
 * Ouvre ou ferme le panneau latéral d'itinéraire par un effet de slide.
 * Modifie aussi le texte et la position du bouton toggle.
 *
 * Méthodes utilisées :
 *  - document.getElementById() : récupère le panneau et les éléments texte.
 *  - panel.classList.toggle('open') : ajoute la classe 'open' si elle est
 *    absente, la retire si elle est présente. Retourne true si la classe
 *    a été ajoutée (panneau ouvert), false si retirée (panneau fermé).
 *  - toggle.classList.toggle('panel-open', isOpen) : version avec valeur
 *    de force : ajoute 'panel-open' si isOpen est true, retire si false.
 *  - label.textContent : mise à jour du texte du bouton selon l'état.
 */
function toggleRoutePanel() {
  const panel  = document.getElementById('route-panel');
  const toggle = document.getElementById('route-toggle');
  const label  = document.getElementById('toggle-label');

  // classList.toggle() retourne true si la classe est maintenant présente
  const isOpen = panel.classList.toggle('open');

  // Synchronisation du style du bouton avec l'état du panneau
  toggle.classList.toggle('panel-open', isOpen);
  label.textContent = isOpen ? 'Fermer' : 'Itinéraire';
}

/**
 * Définit le rayon de recherche et met en surbrillance le chip actif.
 *
 * Méthodes utilisées :
 *  - document.querySelectorAll('.rayon-chip') : sélectionne tous les boutons
 *    de sélection du rayon (NodeList).
 *  - forEach() : itère sur chaque chip.
 *  - btn.classList.toggle('active', condition) : ajoute 'active' si la
 *    condition est vraie (ce chip correspond au rayon sélectionné), retire
 *    sinon — ce qui déselectionne automatiquement les autres chips.
 *  - parseInt(btn.dataset.km) : lit l'attribut data-km du bouton et le
 *    convertit en entier pour la comparaison avec le rayon choisi.
 *
 * @param {number} km - Rayon en kilomètres (5, 10 ou 20)
 */
function setRayon(km) {
  routeRayon = km; // Mise à jour de la variable globale

  // Mise à jour visuelle : on active uniquement le chip correspondant au rayon choisi
  document.querySelectorAll('.rayon-chip').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.km) === km);
  });
}

/**
 * Géocode un nom de ville en coordonnées GPS via l'API Nominatim d'OpenStreetMap.
 * On restreint la recherche à la France pour plus de pertinence.
 *
 * Nominatim est un moteur de géocodage open source basé sur les données OSM.
 * Il ne nécessite pas de clé API mais impose des limites de taux (1 req/sec).
 *
 * Méthodes utilisées :
 *  - encodeURIComponent() : encode les caractères spéciaux dans le nom de ville
 *    pour l'inclure en toute sécurité dans une URL (ex: "Côtes-d'Armor" → "C%C3%B4tes-d%27Armor").
 *  - fetch(url, { headers }) : requête GET avec en-têtes personnalisés.
 *    L'en-tête 'User-Agent' est requis par les conditions d'utilisation de
 *    Nominatim pour identifier l'application appelante.
 *  - await res.json() : désérialisation du tableau de résultats GeoJSON.
 *  - data.length : vérification que Nominatim a retourné au moins un résultat.
 *  - parseFloat() : conversion des chaînes lat/lon en nombres flottants.
 *  - String.split(',')[0].trim() : extrait le premier segment du nom complet
 *    (ex: "Brest, Finistère, Bretagne, France" → "Brest").
 *
 * @param {string} nom - Nom de la ville à géocoder (ex: "Brest")
 * @returns {Promise<{lat: number, lon: number, label: string}>}
 */
async function geocoderVille(nom) {
  // Construction de l'URL Nominatim avec le nom de ville et restriction à la France
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(nom + ', France')}&format=json&limit=1&accept-language=fr`;

  // Requête avec en-tête User-Agent obligatoire selon les CGU de Nominatim
  const res  = await fetch(url, { headers: { 'User-Agent': 'BreizhOhm/1.0' } });
  const data = await res.json();

  // Si aucun résultat, on lève une exception explicite
  if (!data.length) throw new Error(`Ville introuvable : "${nom}"`);

  return {
    lat:   parseFloat(data[0].lat),
    lon:   parseFloat(data[0].lon),
    // On prend juste le premier segment du nom complet pour l'affichage
    label: data[0].display_name.split(',')[0].trim(),
  };
}

/**
 * Calcule l'itinéraire routier entre deux points GPS via l'API OSRM.
 *
 * OSRM (Open Source Routing Machine) est un moteur de routage open source
 * utilisant les données OpenStreetMap. L'instance publique est gratuite
 * et ne nécessite pas de clé API.
 *
 * L'URL est construite sous forme de tableau puis joinée pour plus de lisibilité.
 * Le paramètre 'geometries=geojson' demande la polyline au format GeoJSON
 * (tableau de coordonnées [lon, lat]).
 * Le paramètre 'overview=full' demande la géométrie complète (sans simplification).
 *
 * Méthodes utilisées :
 *  - Array.join('') : concatène les parties de l'URL sans séparateur.
 *  - fetch(url) : requête GET vers l'API OSRM.
 *  - await res.json() : désérialisation de la réponse GeoJSON.
 *  - data.code !== 'Ok' : vérification du code de statut OSRM (différent
 *    des codes HTTP — c'est un code dans le corps JSON).
 *  - data.routes[0].geometry.coordinates : accès au tableau de coordonnées
 *    de la première (et unique) route calculée.
 *
 * @param {{lat:number, lon:number}} depart  - Coordonnées GPS du départ
 * @param {{lat:number, lon:number}} arrivee - Coordonnées GPS de l'arrivée
 * @returns {Promise<Array>} Tableau de coordonnées [[lon, lat], ...] (format GeoJSON)
 */
async function calculerRoute(depart, arrivee) {
  // Construction de l'URL OSRM — format : lon,lat;lon,lat (OSRM utilise lon avant lat)
  const url = [
    'https://router.project-osrm.org/route/v1/driving/',
    `${depart.lon},${depart.lat};${arrivee.lon},${arrivee.lat}`,
    '?geometries=geojson&overview=full',
  ].join('');

  const res  = await fetch(url);
  const data = await res.json();

  // Vérification du code de statut dans le corps JSON (pas le code HTTP)
  if (data.code !== 'Ok') throw new Error('Impossible de calculer cet itinéraire.');

  // Retourne les coordonnées GeoJSON de la route : [[lon, lat], [lon, lat], ...]
  // Note : GeoJSON utilise [lon, lat] alors que Leaflet utilise [lat, lon] — conversion faite ailleurs
  return data.routes[0].geometry.coordinates;
}

/**
 * Calcule la distance en kilomètres entre deux points GPS
 * en utilisant la formule de Haversine.
 *
 * La formule de Haversine donne la distance orthodromique (en ligne droite sur
 * la sphère terrestre) entre deux points définis par leur latitude et longitude.
 * Elle est précise pour des distances inférieures à quelques centaines de km.
 *
 * Méthodes/formules utilisées :
 *  - Math.PI : constante π ≈ 3.14159…
 *  - Conversion degrés → radians : degrés × Math.PI / 180
 *  - Math.sin(), Math.cos() : fonctions trigonométriques en radians.
 *  - ** 2 : opérateur d'exponentiation (carré) — équivalent à Math.pow(x, 2).
 *  - Math.atan2(y, x) : arctangente en 2 arguments, retourne l'angle en radians
 *    dans l'intervalle [-π, π].
 *  - Math.sqrt() : racine carrée.
 *  - R = 6371 : rayon moyen de la Terre en kilomètres.
 *
 * @param {number} lat1 - Latitude du point A (degrés décimaux)
 * @param {number} lon1 - Longitude du point A (degrés décimaux)
 * @param {number} lat2 - Latitude du point B (degrés décimaux)
 * @param {number} lon2 - Longitude du point B (degrés décimaux)
 * @returns {number} Distance en kilomètres
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R  = 6371; // Rayon moyen de la Terre en kilomètres

  // Conversion en radians pour les fonctions trigonométriques JavaScript
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180; // Différence de latitude en radians
  const Δλ = (lon2 - lon1) * Math.PI / 180; // Différence de longitude en radians

  // Formule de Haversine : a = sin²(Δφ/2) + cos(φ1)·cos(φ2)·sin²(Δλ/2)
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  // Distance angulaire en radians × rayon terrestre = distance en km
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calcule la distance minimale en km entre un point GPS et un segment
 * de droite [A, B] défini par deux points GPS.
 *
 * Algorithme : on projette orthogonalement le point P sur la droite (AB),
 * puis on "clamp" (limite) cette projection au segment [A, B].
 * Si la projection tombe hors du segment, le point le plus proche est A ou B.
 *
 * Méthodes/formules utilisées :
 *  - Calcul de t (paramètre de projection) : produit scalaire (P-A)·(B-A) / |B-A|²
 *    t = 0 → le point le plus proche est A
 *    t = 1 → le point le plus proche est B
 *    0 < t < 1 → le point le plus proche est sur le segment
 *  - Math.max(0, Math.min(1, t)) : "clamp" de t entre 0 et 1 pour rester
 *    sur le segment (si la projection tombe hors du segment, on prend l'extrémité).
 *  - haversine() : calcul de la distance entre le point et sa projection.
 *
 * Note : le calcul est effectué en degrés (approximation valide pour de petites
 * distances comme celles rencontrées sur un itinéraire régional breton).
 *
 * @param {number} pLat - Latitude du point P
 * @param {number} pLon - Longitude du point P
 * @param {number} aLat - Latitude du point A (début du segment)
 * @param {number} aLon - Longitude du point A
 * @param {number} bLat - Latitude du point B (fin du segment)
 * @param {number} bLon - Longitude du point B
 * @returns {number} Distance minimale en kilomètres entre P et le segment [A,B]
 */
function distancePointSegment(pLat, pLon, aLat, aLon, bLat, bLon) {
  const dx   = bLon - aLon; // Composante horizontale du vecteur AB
  const dy   = bLat - aLat; // Composante verticale du vecteur AB
  const len2 = dx * dx + dy * dy; // Carré de la norme du vecteur AB

  // Cas dégénéré : A et B sont le même point — on retourne la distance directe
  if (len2 === 0) return haversine(pLat, pLon, aLat, aLon);

  // Paramètre t de la projection orthogonale de P sur la droite (AB)
  // t est clampé entre 0 et 1 pour rester dans les bornes du segment
  const t = Math.max(0, Math.min(1, ((pLon - aLon) * dx + (pLat - aLat) * dy) / len2));

  // Coordonnées du point le plus proche sur le segment [A, B]
  // (interpolation linéaire entre A et B selon le paramètre t)
  return haversine(pLat, pLon, aLat + t * dy, aLon + t * dx);
}

/**
 * Filtre un tableau de bornes pour ne garder que celles situées
 * à moins de "rayon" km du tracé de l'itinéraire.
 *
 * Algorithme :
 * Pour chaque borne, on parcourt tous les segments de la polyline OSRM.
 * Dès qu'un segment est suffisamment proche, la borne est incluse (early exit).
 * Complexité : O(bornes × segments) — acceptable pour des tailles régionales.
 *
 * Méthodes utilisées :
 *  - Array.filter(callback) : retourne un nouveau tableau contenant uniquement
 *    les éléments pour lesquels le callback retourne true.
 *    Le tableau d'origine (bornes) n'est pas modifié.
 *  - parseFloat() + isNaN() : validation des coordonnées GPS.
 *  - Boucle for classique avec break implicite (return true) : on arrête
 *    de parcourir les segments dès qu'on trouve un qui est assez proche.
 *    C'est plus efficace que forEach qui ne supporte pas le break.
 *  - Destructuring : const [aLon, aLat] = routeCoords[i] — décompose le
 *    tableau [lon, lat] retourné par OSRM en deux variables nommées.
 *  - distancePointSegment() : calcul de la distance minimale.
 *
 * @param {Array}  bornes      - Tableau de bornes [{lat, lon, ...}]
 * @param {Array}  routeCoords - Tableau de coordonnées OSRM [[lon, lat], ...]
 * @param {number} rayon       - Distance maximale en km
 * @returns {Array} Sous-tableau des bornes proches de la route
 */
function filtrerBornesSurRoute(bornes, routeCoords, rayon) {
  return bornes.filter(b => {
    const lat = parseFloat(b.lat);
    const lon = parseFloat(b.lon);
    if (isNaN(lat) || isNaN(lon)) return false; // Coordonnées invalides → exclure

    // Parcours de tous les segments de la polyline
    for (let i = 0; i < routeCoords.length - 1; i++) {
      // Déstructuration : OSRM retourne [lon, lat] (ordre GeoJSON)
      const [aLon, aLat] = routeCoords[i];
      const [bLon, bLat] = routeCoords[i + 1];

      // Si la borne est à moins de "rayon" km de ce segment, on l'inclut immédiatement
      if (distancePointSegment(lat, lon, aLat, aLon, bLat, bLon) <= rayon) {
        return true; // Early exit : inutile de vérifier les autres segments
      }
    }
    return false; // Borne trop loin de tous les segments de la route
  });
}

/**
 * Affiche le tracé de l'itinéraire sur la carte Leaflet et place les
 * marqueurs de départ (vert) et d'arrivée (rouge).
 * Supprime le tracé précédent s'il existait.
 *
 * Méthodes utilisées :
 *  - carteLeaflet.removeLayer(routeLayerPolyline) : supprime l'ancienne
 *    polyline de la carte avant d'en tracer une nouvelle.
 *  - Array.map(([lon, lat]) => [lat, lon]) : transformation du format GeoJSON
 *    [lon, lat] vers le format Leaflet [lat, lon] via déstructuration.
 *  - L.polyline(latlngs, options) : crée une polyligne Leaflet avec les
 *    coordonnées du tracé et les options de style (couleur, épaisseur, opacité).
 *  - .addTo(carteLeaflet) : ajoute la polyline à la carte.
 *  - L.divIcon(options) : crée une icône HTML personnalisée (un cercle coloré)
 *    plutôt que l'icône par défaut de Leaflet. className: '' évite les styles par défaut.
 *  - L.marker([lat, lon], { icon }) : crée un marqueur avec l'icône personnalisée.
 *  - .bindPopup(html) : attache une popup HTML au marqueur.
 *  - carteLeaflet.fitBounds(bounds, { padding }) : ajuste automatiquement le
 *    zoom et le centre pour que la polyline entière soit visible, avec une
 *    marge de 40px de chaque côté.
 *  - routeLayerPolyline.getBounds() : retourne les limites géographiques (bounding box)
 *    de la polyline pour l'utiliser avec fitBounds.
 *
 * @param {Array}  routeCoords - Coordonnées du tracé [[lon, lat], ...] (format OSRM/GeoJSON)
 * @param {{lat, lon, label}} ptDepart  - Coordonnées et nom du point de départ
 * @param {{lat, lon, label}} ptArrivee - Coordonnées et nom du point d'arrivée
 */
function afficherTrace(routeCoords, ptDepart, ptArrivee) {
  if (!carteLeaflet) initCarteLeaflet();

  // Suppression de l'ancien tracé si un itinéraire avait déjà été calculé
  if (routeLayerPolyline) carteLeaflet.removeLayer(routeLayerPolyline);

  // Conversion du format GeoJSON [lon, lat] vers le format Leaflet [lat, lon]
  const latlngs = routeCoords.map(([lon, lat]) => [lat, lon]);

  // Création de la polyline avec style visuel
  routeLayerPolyline = L.polyline(latlngs, {
    color:   '#e63946', // Rouge BreizhOhm
    weight:  5,         // Épaisseur en pixels
    opacity: 0.85,      // Semi-transparence pour voir la carte sous le tracé
  }).addTo(carteLeaflet);

  // Fabrique d'icône HTML personnalisée (cercle coloré avec bordure blanche)
  // Retourne un L.DivIcon basé sur une <div> stylée en CSS inline
  const makeIcon = color => L.divIcon({
    className: '', // Désactive les styles CSS par défaut de Leaflet
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>`,
    iconAnchor: [7, 7], // Point d'ancrage au centre du cercle (rayon = 7px)
  });

  // Marqueur de départ (vert) avec popup
  L.marker([ptDepart.lat,  ptDepart.lon],  { icon: makeIcon('#22c55e') })
    .addTo(carteLeaflet)
    .bindPopup(`<b>Départ :</b> ${ptDepart.label}`);

  // Marqueur d'arrivée (rouge) avec popup
  L.marker([ptArrivee.lat, ptArrivee.lon], { icon: makeIcon('#e63946') })
    .addTo(carteLeaflet)
    .bindPopup(`<b>Arrivée :</b> ${ptArrivee.label}`);

  // Ajustement automatique du zoom pour voir tout le trajet avec une marge
  carteLeaflet.fitBounds(routeLayerPolyline.getBounds(), { padding: [40, 40] });
}

/**
 * Met à jour le message de statut affiché dans le panneau d'itinéraire.
 * Utilisé pour informer l'utilisateur des étapes en cours (géocodage,
 * calcul de route, chargement des bornes…) ou des erreurs.
 *
 * Méthodes utilisées :
 *  - document.getElementById('route-status') : récupère l'élément de statut.
 *  - el.textContent : modifie le message affiché (sans interprétation HTML).
 *  - el.className : remplace TOUTE la liste de classes CSS de l'élément
 *    pour appliquer le style correspondant au type (loading, error, warn).
 *    Le CSS doit définir les styles .route-status.loading, .error, .warn.
 *
 * @param {string} msg  - Texte à afficher ('' pour effacer)
 * @param {string} type - Type de message : 'loading' | 'error' | 'warn' | ''
 */
function setRouteStatus(msg, type = '') {
  const el = document.getElementById('route-status');
  el.textContent = msg;
  // On réaffecte className en entier pour nettoyer les anciennes classes de type
  el.className   = 'route-status ' + type;
}

/**
 * Construit et affiche la liste des bornes trouvées dans le panneau latéral.
 * Chaque borne est affichée avec son type, sa puissance et un lien vers le détail.
 *
 * Méthodes utilisées :
 *  - el.innerHTML : injection de HTML généré dynamiquement dans le panneau.
 *  - Array.length : vérification si le tableau est vide.
 *  - Array.map(b => `...`).join('') : génère une chaîne HTML en mappant chaque
 *    borne vers son fragment HTML, puis joint tout sans séparateur.
 *  - Template literals (backticks) : interpolation des données dans le HTML
 *    avec ${ } pour insérer les valeurs dynamiquement.
 *  - Opérateur ternaire : affichage conditionnel du lien "Voir le détail"
 *    uniquement si l'ID de la borne est disponible.
 *
 * @param {Array} bornes - Tableau de bornes [{commune, puissance_nominale, type_prise, id}, ...]
 */
function afficherResultatsRoute(bornes) {
  const el = document.getElementById('route-results');

  // Cas : aucune borne trouvée dans le rayon spécifié
  if (!bornes.length) {
    el.innerHTML = `<p class="route-no-result">
      Aucune borne trouvée à moins de ${routeRayon} km de ce trajet.<br>
      Essayez d'augmenter le rayon de recherche.
    </p>`;
    return;
  }

  // Génération du HTML de la liste des bornes
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
 * Fonction principale de la fonctionnalité itinéraire, déclenchée par
 * le clic sur le bouton "Trouver les bornes".
 *
 * Enchaîne 7 étapes asynchrones :
 *  1. Géocodage des deux villes via Nominatim
 *  2. Calcul du tracé routier via OSRM
 *  3. Affichage du tracé et des marqueurs départ/arrivée sur la carte
 *  4. Construction de la bounding box du tracé + buffer
 *  5. Requête API pour les bornes dans cette zone géographique
 *  6. Filtrage des bornes réellement proches du tracé (Haversine)
 *  7. Affichage des marqueurs et de la liste dans le panneau
 *
 * Méthodes utilisées :
 *  - document.getElementById().value.trim() : lecture des champs de saisie.
 *  - setRouteStatus() : mise à jour du message de statut entre chaque étape.
 *  - await geocoderVille() : géocodage asynchrone du départ et de l'arrivée.
 *  - await calculerRoute() : calcul du tracé via OSRM.
 *  - carteLeaflet.eachLayer() : nettoyage de tous les marqueurs et polylines
 *    existants avant de tracer le nouvel itinéraire.
 *  - afficherTrace() : dessin du tracé sur la carte.
 *  - Array.map(c => c[1]) et Array.map(c => c[0]) : extraction des latitudes
 *    (index 1) et longitudes (index 0) depuis les coordonnées GeoJSON.
 *  - Math.min(...lats) et Math.max(...lats) : calcul des bornes min/max de
 *    la bounding box en utilisant l'opérateur spread (...).
 *  - buffer = 0.15 : marge de ~15 km ajoutée à la bounding box pour inclure
 *    les bornes légèrement hors du tracé exact.
 *  - new URLSearchParams({ bbox }) : initialisation avec un objet pour ajouter
 *    d'emblée le paramètre bbox.
 *  - Optional chaining (?.) : accès sécurisé aux éléments de filtre qui
 *    pourraient ne pas exister dans le DOM (?.value au lieu de .value).
 *  - await fetch() + await res.json() : récupération des bornes dans la bbox.
 *  - filtrerBornesSurRoute() : filtrage géométrique des bornes.
 *  - afficherMarqueurs() : placement des marqueurs sur la carte.
 *  - afficherResultatsRoute() : liste des bornes dans le panneau.
 *  - try/catch : gestion globale des erreurs sur toute la chaîne asynchrone.
 */
async function chercherItineraire() {
  const depart  = document.getElementById('route-depart').value.trim();
  const arrivee = document.getElementById('route-arrivee').value.trim();

  // Validation basique : les deux champs doivent être remplis
  if (!depart || !arrivee) {
    setRouteStatus('⚠ Veuillez saisir un départ et une arrivée.', 'warn');
    return;
  }

  // Réinitialisation des résultats précédents
  document.getElementById('route-results').innerHTML = '';
  setRouteStatus('Géocodage des villes…', 'loading');

  try {
    // ── Étape 1 : géocodage des deux villes via l'API Nominatim ──────────────
    const ptDepart  = await geocoderVille(depart);
    const ptArrivee = await geocoderVille(arrivee);

    setRouteStatus('Calcul de l\'itinéraire…', 'loading');

    // ── Étape 2 : calcul du tracé via l'API OSRM ─────────────────────────────
    const routeCoords = await calculerRoute(ptDepart, ptArrivee);

    // ── Étape 3 : nettoyage de la carte et affichage du tracé ─────────────────
    // On supprime tous les marqueurs et polylines existants avant le nouveau tracé
    carteLeaflet.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        carteLeaflet.removeLayer(layer);
      }
    });
    afficherTrace(routeCoords, ptDepart, ptArrivee);

    setRouteStatus('Chargement des bornes…', 'loading');

    // ── Étape 4 : bounding box du tracé avec buffer de ~15 km ─────────────────
    // On calcule les coordonnées extrêmes de la polyline et on ajoute une marge
    // de 0.15° (~15 km) pour capturer les bornes légèrement hors du tracé exact.
    // Cela limite le volume de données renvoyé par l'API (préfiltrage côté serveur).
    const lats   = routeCoords.map(c => c[1]); // Toutes les latitudes (index 1 = lat dans GeoJSON)
    const lons   = routeCoords.map(c => c[0]); // Toutes les longitudes (index 0 = lon dans GeoJSON)
    const buffer = 0.15; // Environ 15 km de marge autour du tracé
    const bbox   = [
      Math.min(...lons) - buffer,  // Longitude minimale (ouest)
      Math.min(...lats) - buffer,  // Latitude minimale (sud)
      Math.max(...lons) + buffer,  // Longitude maximale (est)
      Math.max(...lats) + buffer,  // Latitude maximale (nord)
    ].join(','); // Format CSV : "minLon,minLat,maxLon,maxLat"

    // ── Étape 5 : requête API des bornes dans la bounding box ─────────────────
    // On récupère aussi les filtres du formulaire principal pour affiner les résultats
    const filtreParams = new URLSearchParams({ bbox });
    // Optional chaining (?.) : évite les erreurs si un élément de filtre est absent du DOM
    const filtreNom        = document.getElementById('carte-nom')?.value.trim();
    const filtreAnnee      = document.getElementById('carte-annee')?.value;
    const filtreDept       = document.getElementById('carte-dept')?.value;
    const filtrePrise      = document.getElementById('carte-prise')?.value;
    const filtreAmenageur  = document.getElementById('carte-amenageur')?.value;
    const filtrePuissance  = document.getElementById('carte-puissance-min')?.value;

    // Ajout conditionnel des filtres non vides
    if (filtreNom)       filtreParams.append('nom',          filtreNom);
    if (filtreAnnee)     filtreParams.append('annee',        filtreAnnee);
    if (filtreDept)      filtreParams.append('dept',         filtreDept);
    if (filtrePrise)     filtreParams.append('prise',        filtrePrise);
    if (filtreAmenageur) filtreParams.append('amenageur',    filtreAmenageur);
    if (filtrePuissance) filtreParams.append('puissance_min', filtrePuissance);

    const res    = await fetch(`${API_BASE}/installations/carte?${filtreParams.toString()}`);
    const bornes = await res.json();

    // ── Étape 6 : filtrage géométrique des bornes proches du tracé ───────────
    // Le filtrage par bbox est un préfiltrage approximatif.
    // filtrerBornesSurRoute() calcule la vraie distance à la route (Haversine)
    // et ne garde que les bornes dans le rayon routeRayon.
    const bornesFiltrees = filtrerBornesSurRoute(bornes, routeCoords, routeRayon);

    // ── Étape 7 : affichage des résultats ─────────────────────────────────────
    // Mise à jour des marqueurs sur la carte (uniquement les bornes filtrées)
    afficherMarqueurs(bornesFiltrees);
    document.getElementById('carte-count').textContent = bornesFiltrees.length;

    // Affichage de la liste des bornes dans le panneau latéral
    afficherResultatsRoute(bornesFiltrees);

    // Effacement du message de statut (recherche terminée avec succès)
    setRouteStatus('', '');

  } catch (err) {
    // Gestion centralisée des erreurs de toute la chaîne asynchrone
    setRouteStatus('❌ ' + err.message, 'error');
  }
}


/**
 * Ouvre le panneau latéral de la carte et charge les Points De Charge (PDC)
 * d'une station donnée via l'API REST.
 *
 * Une "station" peut regrouper plusieurs PDC (bornes individuelles).
 * Route appelée : GET /api/pdcs?station={stationId}
 *
 * Méthodes utilisées :
 *  - document.getElementById() : récupère les éléments du panneau.
 *  - title.textContent : met à jour le titre du panneau avec le nom de la station.
 *  - list.innerHTML : affiche d'abord "Chargement…" pendant la requête,
 *    puis remplace par les cartes PDC une fois les données reçues.
 *  - panel.style.display = 'flex' : rend le panneau visible (layout flex
 *    défini dans le CSS pour l'organisation interne du panneau).
 *  - setTimeout(() => carteLeaflet.invalidateSize(), 50) : après l'ouverture
 *    du panneau, la largeur disponible pour la carte change. On force Leaflet
 *    à recalculer la taille de son canvas après 50ms.
 *  - encodeURIComponent(stationId) : encode l'ID de station pour l'URL
 *    (il peut contenir des caractères spéciaux comme des tirets, des points…).
 *  - await fetch() + await res.json() : chargement des PDC depuis l'API.
 *  - Array.forEach() : création d'une carte HTML pour chaque PDC.
 *  - document.createElement('div') : création d'une carte PDC.
 *  - card.className : classe CSS de la carte.
 *  - card.innerHTML : injection du HTML de la carte avec les données du PDC.
 *  - formatDateMoisAnnee() : formatage de la date de mise en service du PDC.
 *  - list.appendChild(card) : insertion de la carte dans le panneau.
 *
 * @param {string} stationId  - Identifiant de la station (clé étrangère des PDC)
 * @param {string} nomStation - Nom affiché dans le titre du panneau
 * @param {number} lat        - Latitude (non utilisée ici, disponible pour extension)
 * @param {number} lon        - Longitude (non utilisée ici, disponible pour extension)
 */
async function ouvrirPanelStation(stationId, nomStation, lat, lon) {
  const panel = document.getElementById('station-panel');
  const title = document.getElementById('station-panel-title');
  const list  = document.getElementById('station-panel-list');

  // Affichage immédiat du panneau avec un message de chargement
  title.textContent = nomStation || 'Station';
  list.innerHTML = '<p class="panel-loading">Chargement…</p>';
  panel.style.display = 'flex';

  // La carte perd de la largeur à cause du panneau : on lui demande de recalculer
  setTimeout(() => carteLeaflet && carteLeaflet.invalidateSize(), 50);

  try {
    // Requête vers l'API pour récupérer tous les PDC de cette station
    const res = await fetch(`${API_BASE}/pdcs?station=${encodeURIComponent(stationId)}`);

    if (!res.ok) {
      const corps = await res.text();
      throw new Error(`HTTP ${res.status} — ${corps}`);
    }

    const pdcs = await res.json();

    // Réinitialisation du contenu du panneau
    list.innerHTML = '';

    if (!pdcs.length) {
      list.innerHTML = '<p class="panel-loading">Aucun point de charge.</p>';
      return;
    }

    // Création d'une carte HTML pour chaque PDC retourné par l'API
    pdcs.forEach(pdc => {
      const card = document.createElement('div');
      card.className = 'pdc-card';
      card.innerHTML = `
        <div class="pdc-card-info">
          <div class="pdc-type">${pdc.type_prise || '—'}</div>
          <div class="pdc-meta">
            ${pdc.puissance_nominale ? pdc.puissance_nominale + ' kW' : '—'}
            ${pdc.acces_recharge ? ' · ' + pdc.acces_recharge : ''}
          </div>
          <div class="pdc-meta">${formatDateMoisAnnee(pdc.date_mise_service)}</div>
        </div>
        <a href="recherche.html?detail=${pdc.id}" class="btn-detail">Détail →</a>`;
      list.appendChild(card);
    });

  } catch (err) {
    list.innerHTML = '<p class="panel-loading">⚠ Erreur de chargement.</p>';
    console.error('Erreur PDC station :', err);
  }
}

/**
 * Ferme le panneau latéral de la station et redonne tout l'espace à la carte.
 *
 * Méthodes utilisées :
 *  - panel.style.display = 'none' : masque le panneau via CSS inline.
 *  - setTimeout(() => carteLeaflet.invalidateSize(), 50) : après la fermeture,
 *    la carte récupère toute sa largeur. On force Leaflet à recalculer
 *    ses dimensions pour afficher les tuiles correctement.
 *    Le délai de 50ms laisse le temps au navigateur de relayer le DOM.
 */
function fermerPanelStation() {
  const panel = document.getElementById('station-panel');
  panel.style.display = 'none';
  // Recalcul de la taille de la carte après fermeture du panneau
  setTimeout(() => carteLeaflet && carteLeaflet.invalidateSize(), 50);
}
