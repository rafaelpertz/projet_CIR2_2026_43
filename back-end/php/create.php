<?php
// ============================================================
//  /back/create.php — Formulaire de création d'une installation
// ============================================================

require_once __DIR__ . '/IRVEModel.php';

$errors  = [];
$success = false;

// Traitement du formulaire quand il est soumis (méthode POST)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // --- Validation simple des champs obligatoires ---
    $required = ['nom_amenageur', 'nom_operateur', 'nom_commune', 'nbre_pdc', 'type_prise'];
    foreach ($required as $field) {
        if (empty(trim($_POST[$field] ?? ''))) {
            $errors[] = "Le champ « $field » est obligatoire.";
        }
    }

    if (empty($errors)) {
        // Nettoyage des données reçues (htmlspecialchars côté affichage, trim ici)
        $data = [
            'nom_amenageur'        => trim($_POST['nom_amenageur']),
            'siren_amenageur'      => trim($_POST['siren_amenageur']      ?? ''),
            'contact_amenageur'    => trim($_POST['contact_amenageur']    ?? ''),
            'nom_operateur'        => trim($_POST['nom_operateur']),
            'nom_commune'          => trim($_POST['nom_commune']),
            'code_insee'           => trim($_POST['code_insee']           ?? ''),
            'nbre_pdc'             => (int) $_POST['nbre_pdc'],
            'type_prise'           => trim($_POST['type_prise']),
            'puissance_nominale'   => !empty($_POST['puissance_nominale']) ? (float) $_POST['puissance_nominale'] : null,
            'coordonneesXY'        => !empty($_POST['lat']) && !empty($_POST['lng'])
                                        ? $_POST['lng'] . ',' . $_POST['lat']  // format lon,lat
                                        : null,
            'date_mise_en_service' => !empty($_POST['date_mise_en_service']) ? $_POST['date_mise_en_service'] : null,
        ];

        try {
            $model = new IRVEModel();
            $newId = $model->create($data);
            // Redirection vers le détail de l'item créé
            header('Location: detail.php?id=' . $newId . '&created=1');
            exit;
        } catch (PDOException $e) {
            $errors[] = "Erreur lors de l'enregistrement : " . $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Back – Création | Breizh IRVE</title>
  <link rel="stylesheet" href="../css/back.css"/>
</head>
<body>

<?php include __DIR__ . '/includes/header.php'; ?>

<main>
  <section class="container">
    <div class="page-header">
      <h1>Ajouter un point de recharge</h1>
      <a href="index.php" class="btn btn-outline">← Retour</a>
    </div>

    <?php if (!empty($errors)): ?>
      <div class="alert alert-danger">
        <?php foreach ($errors as $e): ?>
          <p><?= htmlspecialchars($e) ?></p>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>

    <!-- action="" soumet vers le même fichier (create.php) en POST -->
    <form method="POST" action="">

      <div class="card">
        <div class="card-title">Aménageur &amp; Opérateur</div>
        <div class="form-row">
          <div class="form-group">
            <label>Nom aménageur <span class="req">*</span></label>
            <input type="text" name="nom_amenageur"
                   value="<?= htmlspecialchars($_POST['nom_amenageur'] ?? '') ?>"
                   placeholder="ex : LE ROUX LOISIRS"/>
          </div>
          <div class="form-group">
            <label>Siren aménageur</label>
            <input type="text" name="siren_amenageur"
                   value="<?= htmlspecialchars($_POST['siren_amenageur'] ?? '') ?>"
                   placeholder="ex : 453386120"/>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Contact aménageur (email)</label>
            <input type="email" name="contact_amenageur"
                   value="<?= htmlspecialchars($_POST['contact_amenageur'] ?? '') ?>"/>
          </div>
          <div class="form-group">
            <label>Nom opérateur <span class="req">*</span></label>
            <input type="text" name="nom_operateur"
                   value="<?= htmlspecialchars($_POST['nom_operateur'] ?? '') ?>"/>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Caractéristiques</div>
        <div class="form-row">
          <div class="form-group">
            <label>Nombre de PDC <span class="req">*</span></label>
            <input type="number" name="nbre_pdc" min="1"
                   value="<?= htmlspecialchars($_POST['nbre_pdc'] ?? '') ?>"/>
          </div>
          <div class="form-group">
            <label>Type de prise <span class="req">*</span></label>
            <select name="type_prise">
              <option value="">-- Sélectionner --</option>
              <?php foreach (['T2','T3 (CCS)','CHAdeMO','EF'] as $t): ?>
                <option value="<?= $t ?>" <?= (($_POST['type_prise'] ?? '') === $t) ? 'selected' : '' ?>>
                  <?= $t ?>
                </option>
              <?php endforeach; ?>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Puissance nominale (kW)</label>
            <input type="number" name="puissance_nominale" step="0.1"
                   value="<?= htmlspecialchars($_POST['puissance_nominale'] ?? '') ?>"/>
          </div>
          <div class="form-group">
            <label>Date de mise en service</label>
            <input type="date" name="date_mise_en_service"
                   value="<?= htmlspecialchars($_POST['date_mise_en_service'] ?? '') ?>"/>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Localisation</div>
        <div class="form-row">
          <div class="form-group">
            <label>Commune <span class="req">*</span></label>
            <input type="text" name="nom_commune"
                   value="<?= htmlspecialchars($_POST['nom_commune'] ?? '') ?>"/>
          </div>
          <div class="form-group">
            <label>Code INSEE</label>
            <input type="text" name="code_insee"
                   value="<?= htmlspecialchars($_POST['code_insee'] ?? '') ?>"/>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Latitude</label>
            <input type="number" name="lat" step="0.00001"
                   value="<?= htmlspecialchars($_POST['lat'] ?? '') ?>"
                   placeholder="ex : 48.11726"/>
          </div>
          <div class="form-group">
            <label>Longitude</label>
            <input type="number" name="lng" step="0.00001"
                   value="<?= htmlspecialchars($_POST['lng'] ?? '') ?>"
                   placeholder="ex : -1.67792"/>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <a href="index.php" class="btn btn-outline">Annuler</a>
        <button type="submit" class="btn btn-primary">Enregistrer l'installation</button>
      </div>

    </form>
  </section>
</main>

<?php include __DIR__ . '/includes/footer.php'; ?>
</body>
</html>
