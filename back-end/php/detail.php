<?php
// ============================================================
//  /back/detail.php — Affichage complet d'une installation
//  URL attendue : /back/detail.php?id=781
// ============================================================

require_once __DIR__ . '/IRVEModel.php';

$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($id <= 0) {
    header('Location: index.php');
    exit;
}

try {
    $model = new IRVEModel();
    $item  = $model->getById($id);

    if (!$item) {
        header('Location: index.php');
        exit;
    }
} catch (PDOException $e) {
    die("Erreur : " . $e->getMessage());
}

// Petit helper pour afficher une valeur ou "—" si vide
$val = fn($key) => !empty($item[$key]) ? htmlspecialchars($item[$key]) : '—';
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Back – Détail #<?= $id ?> | Breizh IRVE</title>
  <link rel="stylesheet" href="../css/back.css"/>
</head>
<body>

<?php include __DIR__ . '/includes/header.php'; ?>

<main>
  <section class="container">

    <?php if (isset($_GET['created'])): ?>
      <div class="alert alert-success">Installation créée avec succès !</div>
    <?php elseif (isset($_GET['updated'])): ?>
      <div class="alert alert-success">Installation mise à jour avec succès !</div>
    <?php endif; ?>

    <div class="page-header">
      <h1>Installation #<?= $id ?></h1>
      <div style="display:flex;gap:8px;">
        <a href="edit.php?id=<?= $id ?>" class="btn btn-primary">Modifier</a>
        <a href="index.php"              class="btn btn-outline">← Liste</a>
      </div>
    </div>

    <!-- Aménageur -->
    <div class="card">
      <div class="card-title">Aménageur &amp; Opérateur</div>
      <table class="detail-table">
        <tr><th>Nom aménageur</th>    <td><?= $val('nom_amenageur') ?></td></tr>
        <tr><th>Siren</th>            <td><?= $val('siren_amenageur') ?></td></tr>
        <tr><th>Contact aménageur</th><td><?= $val('contact_amenageur') ?></td></tr>
        <tr><th>Nom opérateur</th>    <td><?= $val('nom_operateur') ?></td></tr>
        <tr><th>Contact opérateur</th><td><?= $val('contact_operateur') ?></td></tr>
        <tr><th>Téléphone</th>        <td><?= $val('telephone_operateur') ?></td></tr>
        <tr><th>Nom enseigne</th>     <td><?= $val('nom_enseigne') ?></td></tr>
      </table>
    </div>

    <!-- Installation -->
    <div class="card">
      <div class="card-title">Caractéristiques</div>
      <table class="detail-table">
        <tr><th>ID station</th>             <td><?= $val('id_station_itinerance') ?></td></tr>
        <tr><th>Nombre de PDC</th>          <td><?= $val('nbre_pdc') ?></td></tr>
        <tr><th>Type de prise</th>          <td><?= $val('type_prise') ?></td></tr>
        <tr><th>Puissance nominale (kW)</th><td><?= $val('puissance_nominale') ?></td></tr>
        <tr><th>Date mise en service</th>   <td><?= $val('date_mise_en_service') ?></td></tr>
        <tr><th>Accès recharge</th>         <td><?= $val('acces_recharge') ?></td></tr>
        <tr><th>Horaires</th>               <td><?= $val('horaires') ?></td></tr>
      </table>
    </div>

    <!-- Localisation -->
    <div class="card">
      <div class="card-title">Localisation</div>
      <table class="detail-table">
        <tr><th>Commune</th>      <td><?= $val('nom_commune') ?></td></tr>
        <tr><th>Code INSEE</th>   <td><?= $val('code_insee') ?></td></tr>
        <tr><th>Adresse</th>      <td><?= $val('adresse_station') ?></td></tr>
        <tr><th>Coordonnées</th>  <td><?= $val('coordonneesXY') ?></td></tr>
      </table>
    </div>

  </section>
</main>

<?php include __DIR__ . '/includes/footer.php'; ?>
</body>
</html>
