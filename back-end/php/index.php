<?php
// ============================================================
//  /back/index.php — Accueil back-end : tableau des 100 items
// ============================================================

require_once __DIR__ . '/IRVEModel.php';

$model = new IRVEModel();

// Récupération des données (avec gestion d'erreur simple)
try {
    $installations = $model->getListe();
} catch (PDOException $e) {
    $installations = [];
    $error = "Erreur de connexion à la base de données : " . $e->getMessage();
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Back – Accueil | Breizh IRVE</title>
  <link rel="stylesheet" href="../css/back.css"/>
</head>
<body>

<?php include __DIR__ . '/includes/header.php'; ?>

<main>
  <section class="container">
    <div class="page-header">
      <h1>Tableau de bord</h1>
      <a href="create.php" class="btn btn-primary">+ Ajouter une installation</a>
    </div>

    <?php if (isset($error)): ?>
      <div class="alert alert-danger"><?= htmlspecialchars($error) ?></div>
    <?php endif; ?>

    <p class="list-count"><?= count($installations) ?> enregistrements affichés (max 100)</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Aménageur</th>
            <th>Opérateur</th>
            <th>Commune</th>
            <th>Nb PDC</th>
            <th>Type prise</th>
            <th>Puissance</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <?php if (empty($installations)): ?>
            <tr><td colspan="8" class="empty">Aucune donnée trouvée.</td></tr>
          <?php else: ?>
            <?php foreach ($installations as $row): ?>
              <tr>
                <td><?= htmlspecialchars($row['id']) ?></td>
                <td><?= htmlspecialchars($row['nom_amenageur']) ?></td>
                <td><?= htmlspecialchars($row['nom_operateur']) ?></td>
                <td><?= htmlspecialchars($row['nom_commune']) ?></td>
                <td><?= htmlspecialchars($row['nbre_pdc']) ?></td>
                <td><?= htmlspecialchars($row['type_prise']) ?></td>
                <td><?= htmlspecialchars($row['puissance_nominale']) ?> kW</td>
                <td class="actions-cell">
                  <a href="detail.php?id=<?= $row['id'] ?>" class="btn btn-info btn-sm">Voir</a>
                  <a href="edit.php?id=<?= $row['id'] ?>"   class="btn btn-warning btn-sm">Éditer</a>
                </td>
              </tr>
            <?php endforeach; ?>
          <?php endif; ?>
        </tbody>
      </table>
    </div>
  </section>
</main>

<?php include __DIR__ . '/includes/footer.php'; ?>
</body>
</html>
