<?php
// ============================================================
//  breizh_detail.php — Détail d'une installation + recherche
//
//  Paramètres GET acceptés :
//    ?id=X   → affiche le détail de l'installation X
//    ?nom=Y  → recherche les aménageurs dont le nom contient Y
//
//  Fonctionnement :
//    - PHP lit les paramètres dans l'URL ($_GET)
//    - Appelle le modèle pour interroger la base
//    - Génère le HTML avec les données — aucun JS nécessaire
// ============================================================
// Allow access from your specific frontend origin
header("Access-Control-Allow-Origin: http://your-frontend-domain.com"); 
// Or for local development testing only (do not use * in production):
// header("Access-Control-Allow-Origin: *");

header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once 'php/IRVEModel.php';

$model = new IRVEModel();

// Récupère l'id passé dans l'URL (ex: ?id=42), 0 si absent
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

// Récupère le terme de recherche passé dans l'URL (ex: ?nom=Rennes)
$recherche = trim($_GET['nom'] ?? '');

// Charge le détail si un id est fourni
$item = ($id > 0) ? $model->getById($id) : null;

// Lance la recherche si un terme est fourni
$resultats_recherche = ($recherche !== '') ? $model->searchByNom($recherche) : [];

// Table de correspondance code département → libellé
$depts = [
    '22' => '22 – Côtes-d\'Armor',
    '29' => '29 – Finistère',
    '35' => '35 – Ille-et-Vilaine',
    '56' => '56 – Morbihan',
];

// Fonction utilitaire : échappe les caractères spéciaux HTML (anti-XSS)
function e($valeur): string {
    return htmlspecialchars((string)($valeur ?? ''), ENT_QUOTES, 'UTF-8');
}

// Extrait le département depuis le code INSEE (2 premiers chiffres)
$dept = '—';
if ($item && !empty($item['code_insee'])) {
    $code2 = substr((string)$item['code_insee'], 0, 2);
    $dept  = $depts[$code2] ?? $code2;
}

// Extrait latitude et longitude depuis le champ "lng,lat"
$lat = '—';
$lng = '—';
if ($item && !empty($item['coordonneesXY'])) {
    $parts = explode(',', $item['coordonneesXY'], 2);
    $lng   = $parts[0] ?? '—';
    $lat   = $parts[1] ?? '—';
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Détail – IRVE Breizh</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="breizh_style.css"/>
</head>
<body>

<!-- BARRE DE NAVIGATION DEMO -->
<div id="demo-nav">
  <span>Back-End</span>
  <a class="demo-btn" href="index.php">🏠 Accueil</a>
  <a class="demo-btn" href="breizh_creation.php">➕ Création</a>
  <a class="demo-btn active" href="breizh_detail.php">🔍 Détail</a>
  <a class="demo-btn" href="breizh_liste.php">📋 Liste</a>
</div>

<div class="page-wrapper">
  <header>
    <div class="header-brand">
      <div class="header-logo"><img src="../assets/logo_breizh_charge_groupe43_v2.png" alt="Breizh Ohm"/></div>
      <span class="brand-name">Breizh Ohm</span>
    </div>
    <nav>
      <a href="index.php">Accueil</a>
      <a href="breizh_liste.php">Liste</a>
      <a href="breizh_creation.php">Ajouter</a>
    </nav>
  </header>

  <main>
    <section>
      <div class="section-layout" style="margin-bottom:24px;">
        <div><div class="section-title">Visualisation item :</div></div>
      </div>

      <!-- ====================================================
           FORMULAIRE DE RECHERCHE PAR NOM D'AMÉNAGEUR
           Soumet en GET : breizh_detail.php?nom=texte
      ==================================================== -->
      <div style="max-width:700px;margin-bottom:28px;">
        <form method="GET" action="breizh_detail.php" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <input
            type="text"
            name="nom"
            value="<?= e($recherche) ?>"
            placeholder="Rechercher par nom d'aménageur…"
            style="flex:1;min-width:220px;padding:10px 14px;border:1px solid #ddd;border-radius:8px;font-size:14px;font-family:inherit;outline:none;"
          />
          <button type="submit" class="btn btn-primary">🔍 Rechercher</button>
        </form>

        <!-- Résultats de recherche — affichés uniquement si une recherche a été faite -->
        <?php if ($recherche !== ''): ?>
          <?php if (empty($resultats_recherche)): ?>
            <p style="color:#e74c3c;font-size:14px;margin-top:16px;">
              Aucun aménageur trouvé pour « <?= e($recherche) ?> ».
            </p>
          <?php else: ?>
            <p style="font-size:13px;color:#aaa;font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin:16px 0 10px;">
              <?= count($resultats_recherche) ?> résultat(s) — cliquez pour voir le détail
            </p>
            <table class="detail-table" style="max-width:700px;width:100%;">
              <thead>
                <tr style="background:#f5f5f5;">
                  <th style="padding:8px 12px;text-align:left;">Nom aménageur</th>
                  <th style="padding:8px 12px;text-align:left;">Siren</th>
                  <th style="padding:8px 12px;text-align:left;">Contact</th>
                  <th style="padding:8px 12px;text-align:left;">Opérateur</th>
                  <th style="padding:8px 12px;text-align:left;">Commune</th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($resultats_recherche as $r): ?>
                  <!-- Chaque ligne est un lien vers le détail de l'installation -->
                  <tr style="cursor:pointer;" onclick="window.location='breizh_detail.php?id=<?= e($r['id']) ?>'">
                    <td style="padding:8px 12px;"><?= e($r['nom_amenageur']) ?></td>
                    <td style="padding:8px 12px;"><?= e($r['siren_amenageur']) ?></td>
                    <td style="padding:8px 12px;"><?= e($r['contact_amenageur']) ?></td>
                    <td style="padding:8px 12px;"><?= e($r['nom_operateur']) ?></td>
                    <td style="padding:8px 12px;"><?= e($r['nom_commune']) ?></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          <?php endif; ?>
        <?php endif; ?>
      </div>

      <!-- ====================================================
           DÉTAIL DE L'INSTALLATION
           Affiché uniquement si un ?id= valide est fourni
      ==================================================== -->
      <div id="detail-wrap" style="max-width:700px;">
        <?php if ($item): ?>

          <p style="font-size:13px;color:#aaa;margin-bottom:20px;font-weight:500;text-transform:uppercase;letter-spacing:.5px;">Aménageur &amp; Opérateur</p>
          <table class="detail-table">
            <tr><th>Nom aménageur</th>    <td><?= e($item['nom_amenageur']) ?></td></tr>
            <tr><th>Siren</th>            <td><?= e($item['siren_amenageur']) ?></td></tr>
            <tr><th>Contact aménageur</th><td><?= e($item['contact_amenageur']) ?></td></tr>
            <tr><th>Nom opérateur</th>    <td><?= e($item['nom_operateur']) ?></td></tr>
            <tr><th>Contact opérateur</th><td><?= e($item['contact_operateur']) ?></td></tr>
            <tr><th>Téléphone</th>        <td><?= e($item['telephone_operateur']) ?></td></tr>
          </table>

          <p style="font-size:13px;color:#aaa;margin:24px 0 12px;font-weight:500;text-transform:uppercase;letter-spacing:.5px;">Installation</p>
          <table class="detail-table">
            <tr><th>ID station</th>          <td><?= e($item['id_station_itinerance']) ?></td></tr>
            <tr><th>Nombre de PDC</th>       <td><?= e($item['nbre_pdc']) ?></td></tr>
            <tr><th>Type de prise</th>       <td><?= e($item['type_prise']) ?></td></tr>
            <tr><th>Puissance nominale</th>  <td><?= $item['puissance_nominale'] ? e($item['puissance_nominale']) . ' kW' : '—' ?></td></tr>
            <tr><th>Date mise en service</th><td><?= e($item['date_mise_en_service']) ?></td></tr>
            <tr><th>Accès</th>              <td><?= e($item['acces_recharge']) ?></td></tr>
          </table>

          <p style="font-size:13px;color:#aaa;margin:24px 0 12px;font-weight:500;text-transform:uppercase;letter-spacing:.5px;">Localisation</p>
          <table class="detail-table">
            <tr><th>Commune</th>    <td><?= e($item['nom_commune']) ?></td></tr>
            <tr><th>Département</th><td><?= e($dept) ?></td></tr>
            <tr><th>Adresse</th>    <td><?= e($item['adresse_station']) ?></td></tr>
            <tr><th>Latitude</th>   <td><?= e($lat) ?></td></tr>
            <tr><th>Longitude</th>  <td><?= e($lng) ?></td></tr>
          </table>

          <br>
          <div style="display:flex;gap:10px;align-items:flex-start;">
            <!-- Lien vers la page de modification avec l'id en paramètre -->
            <a class="btn btn-primary" href="breizh_modification.php?id=<?= e($id) ?>">✏️ Modifier</a>
            <a class="btn btn-outline" href="breizh_liste.php">← Retour</a>
          </div>

        <?php elseif ($id > 0): ?>
          <!-- L'id fourni ne correspond à aucun enregistrement -->
          <p style="color:#e74c3c;">Aucune installation trouvée pour l'identifiant <?= e($id) ?>.</p>
        <?php else: ?>
          <!-- Aucun id dans l'URL : inviter l'utilisateur à chercher -->
          <p style="color:#aaa;font-size:14px;">Utilisez la recherche ci-dessus ou accédez via la liste.</p>
        <?php endif; ?>
      </div>
    </section>
  </main>

  <footer>
    <div class="footer-brand">
      <div class="footer-logo"><img src="../assets/logo_breizh_charge_groupe43_v2.png" alt="Breizh Ohm"/></div>
      <div><div class="footer-name">Breizh Ohm</div></div>
    </div>
    <div class="footer-meta"><p>Florian Muller / Rafaël Touzé</p><p>CIN2 2026 groupe 13</p></div>
  </footer>
</div>

</body>
</html>
