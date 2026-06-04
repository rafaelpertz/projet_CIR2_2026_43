<?php
// ============================================================
//  breizh_liste.php — Liste des installations (rendu serveur)
//
//  Fonctionnement :
//    1. On charge les données depuis la base via IRVEModel
//    2. PHP génère directement le tableau HTML
//    Aucun JavaScript ni appel AJAX nécessaire.
// ============================================================

require_once 'php/IRVEModel.php';

$model = new IRVEModel();

// Récupère les 100 premières installations (retourne un tableau de lignes)
$liste = $model->getListe();

// Fonction utilitaire : échappe les caractères spéciaux HTML
// Empêche les injections XSS dans l'affichage
function e($valeur): string {
    return htmlspecialchars((string)($valeur ?? ''), ENT_QUOTES, 'UTF-8');
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Liste – IRVE Breizh</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="breizh_style.css"/>
</head>
<body>

<!-- BARRE DE NAVIGATION DEMO -->
<div id="demo-nav">
  <span>Back-End</span>
  <a class="demo-btn" href="index.php">🏠 Accueil</a>
  <a class="demo-btn" href="breizh_creation.php">➕ Création</a>
  <a class="demo-btn" href="breizh_detail.php">🔍 Détail</a>
  <a class="demo-btn active" href="breizh_liste.php">📋 Liste</a>
</div>

<div class="page-wrapper">
  <header>
    <div class="header-brand">
      <div class="header-logo"><img src="../assets/logo_breizh_charge_groupe43_v2.png" alt="Breizh Ohm"/></div>
      <span class="brand-name">Breizh Ohm</span>
    </div>
    <nav>
      <a href="index.php">Accueil</a>
      <a class="active">Liste</a>
      <a href="breizh_creation.php">Ajouter</a>
    </nav>
  </header>

  <main>
    <section>
      <div class="list-header">
        <div>
          <div class="section-title" style="margin-bottom:6px;">Liste des installations</div>
          <!-- count calculé côté serveur, pas besoin de JS -->
          <div class="list-count">affichage limité à 100 éléments</div>
        </div>
        <a class="btn btn-primary" href="breizh_creation.php">+ Ajouter une installation</a>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Aménageur</th><th>Opérateur</th><th>Commune</th>
              <th>Nb PDC</th><th>Type prise</th><th>Puissance</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <?php if (empty($liste)): ?>
              <!-- Aucune donnée en base -->
              <tr>
                <td colspan="8" style="text-align:center;color:#aaa;padding:24px;">
                  Aucune donnée trouvée.
                </td>
              </tr>
            <?php else: ?>
              <!-- On parcourt chaque installation et on génère une ligne -->
              <?php foreach ($liste as $row): ?>
                <tr>
                  <td><?= e($row['id']) ?></td>
                  <td><?= e($row['nom_amenageur']) ?></td>
                  <td><?= e($row['nom_operateur']) ?></td>
                  <td><?= e($row['nom_commune']) ?></td>
                  <td><?= e($row['nbre_pdc']) ?></td>
                  <td><?= e($row['type_prise']) ?></td>
                  <td><?= $row['puissance_nominale'] ? e($row['puissance_nominale']) . ' kW' : '—' ?></td>
                  <td class="actions-cell">
                    <!-- Les liens portent l'id en paramètre d'URL -->
                    <a class="btn btn-outline btn-sm" href="breizh_detail.php?id=<?= e($row['id']) ?>">Voir</a>
                    <a class="btn btn-outline btn-sm" href="breizh_modification.php?id=<?= e($row['id']) ?>">Éditer</a>
                  </td>
                </tr>
              <?php endforeach; ?>
            <?php endif; ?>
          </tbody>
        </table>
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
