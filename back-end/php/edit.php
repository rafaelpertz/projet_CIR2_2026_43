<?php
// ============================================================
//  /back/edit.php — Modification d'une installation existante
//  URL attendue : /back/edit.php?id=781
// ============================================================

require_once __DIR__ . '/IRVEModel.php';

$model  = new IRVEModel();
$errors = [];

// Récupération de l'id passé en GET (?id=...)
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($id <= 0) {
    header('Location: index.php');
    exit;
}

// --- Traitement du formulaire (POST) ---
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $required = ['nom_amenageur', 'nom_operateur', 'nom_commune', 'nbre_pdc', 'type_prise'];
    foreach ($required as $field) {
        if (empty(trim($_POST[$field] ?? ''))) {
            $errors[] = "Le champ « $field » est obligatoire.";
        }
    }

    if (empty($errors)) {
        $data = [
            'nom_amenageur'        => trim($_POST['nom_amenageur']),
            'siren_amenageur'      => trim($_POST['siren_amenageur']      ?? ''),
            'contact_amenageur'    => trim($_POST['contact_amenageur']    ?? ''),
            'nom_operateur'        => trim($_POST['nom_operateur']),
            'nom_commune'          => trim($_POST['nom_commune']),
            'nbre_pdc'             => (int) $_POST['nbre_pdc'],
            'type_prise'           => trim($_POST['type_prise']),
            'puissance_nominale'   => !empty($_POST['puissance_nominale']) ? (float) $_POST['puissance_nominale'] : null,
            'date_mise_en_service' => !empty($_POST['date_mise_en_service']) ? $_POST['date_mise_en_service'] : null,
        ];

        try {
            $model->update($id, $data);
            header('Location: detail.php?id=' . $id . '&updated=1');
            exit;
        } catch (PDOException $e) {
            $errors[] = "Erreur lors de la mise à jour : " . $e->getMessage();
        }
    }
}

// --- Chargement des données actuelles pour préremplir le formulaire ---
try {
    $item = $model->getById($id);
    if (!$item) {
        header('Location: index.php');
        exit;
    }
} catch (PDOException $e) {
    die("Erreur : " . $e->getMessage());
}

// Préremplissage : on utilise POST si disponible (re-soumission), sinon les données BDD
$v = fn(string $key) => htmlspecialchars($_POST[$key] ?? $item[$key] ?? '');
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Back – Modifier #<?= $id ?> | Breizh IRVE</title>
  <link rel="stylesheet" href="../css/back.css"/>
</head>
<body>

<?php include __DIR__ . '/includes/header.php'; ?>

<main>
  <section class="container">
    <div class="page-header">
      <h1>Modifier l'installation #<?= $id ?></h1>
      <a href="detail.php?id=<?= $id ?>" class="btn btn-outline">← Retour au détail</a>
    </div>

    <?php if (!empty($errors)): ?>
      <div class="alert alert-danger">
        <?php foreach ($errors as $e): ?>
          <p><?= htmlspecialchars($e) ?></p>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>

    <form method="POST" action="edit.php?id=<?= $id ?>">

      <div class="card">
        <div class="card-title">Aménageur &amp; Opérateur</div>
        <div class="form-row">
          <div class="form-group">
            <label>Nom aménageur <span class="req">*</span></label>
            <input type="text" name="nom_amenageur" value="<?= $v('nom_amenageur') ?>"/>
          </div>
          <div class="form-group">
            <label>Siren</label>
            <input type="text" name="siren_amenageur" value="<?= $v('siren_amenageur') ?>"/>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Contact aménageur</label>
            <input type="email" name="contact_amenageur" value="<?= $v('contact_amenageur') ?>"/>
          </div>
          <div class="form-group">
            <label>Nom opérateur <span class="req">*</span></label>
            <input type="text" name="nom_operateur" value="<?= $v('nom_operateur') ?>"/>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Caractéristiques</div>
        <div class="form-row">
          <div class="form-group">
            <label>Nombre de PDC <span class="req">*</span></label>
            <input type="number" name="nbre_pdc" min="1" value="<?= $v('nbre_pdc') ?>"/>
          </div>
          <div class="form-group">
            <label>Type de prise <span class="req">*</span></label>
            <select name="type_prise">
              <?php foreach (['T2','T3 (CCS)','CHAdeMO','EF'] as $t): ?>
                <option value="<?= $t ?>" <?= ($v('type_prise') === $t) ? 'selected' : '' ?>>
                  <?= $t ?>
                </option>
              <?php endforeach; ?>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Puissance nominale (kW)</label>
            <input type="number" name="puissance_nominale" step="0.1" value="<?= $v('puissance_nominale') ?>"/>
          </div>
          <div class="form-group">
            <label>Date de mise en service</label>
            <input type="date" name="date_mise_en_service" value="<?= $v('date_mise_en_service') ?>"/>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Localisation</div>
        <div class="form-row">
          <div class="form-group">
            <label>Commune <span class="req">*</span></label>
            <input type="text" name="nom_commune" value="<?= $v('nom_commune') ?>"/>
          </div>
        </div>
      </div>

      <div class="form-actions" style="justify-content:space-between;">
        <!-- Bouton suppression : envoie vers delete.php -->
        <a href="delete.php?id=<?= $id ?>"
           class="btn btn-danger"
           onclick="return confirm('Confirmer la suppression de l\'installation #<?= $id ?> ?')">
          Supprimer
        </a>
        <div style="display:flex;gap:10px;">
          <a href="detail.php?id=<?= $id ?>" class="btn btn-outline">Annuler</a>
          <button type="submit" class="btn btn-primary">Enregistrer</button>
        </div>
      </div>

    </form>
  </section>
</main>

<?php include __DIR__ . '/includes/footer.php'; ?>
</body>
</html>
