<?php
// ============================================================
//  breizh_creation.php — Ajout d'une nouvelle installation
//
//  Fonctionnement :
//    GET  → affiche le formulaire vide
//    POST → valide les données, insère en base, redirige vers le détail
//
//  En cas d'erreur de validation : le formulaire est réaffiché
//  avec un message d'erreur ($erreur) et les valeurs saisies
//  conservées ($champs) pour ne pas forcer l'utilisateur à tout resaisir.
// ============================================================

require_once 'php/IRVEModel.php';

// Fonction utilitaire : échappe les caractères spéciaux HTML (anti-XSS)
function e($valeur): string {
    return htmlspecialchars((string)($valeur ?? ''), ENT_QUOTES, 'UTF-8');
}

$erreur = '';   // Message d'erreur à afficher dans le formulaire
$champs = [];   // Valeurs saisies à réafficher en cas d'erreur

// ---- Traitement du formulaire soumis ----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // Récupère et nettoie chaque champ envoyé
    $champs = [
        'nom_amenageur'        => trim($_POST['nom_amenageur']        ?? ''),
        'siren_amenageur'      => trim($_POST['siren_amenageur']      ?? ''),
        'contact_amenageur'    => trim($_POST['contact_amenageur']    ?? ''),
        'nom_operateur'        => trim($_POST['nom_operateur']        ?? ''),
        'nom_commune'          => trim($_POST['nom_commune']          ?? ''),
        'nbre_pdc'             => trim($_POST['nbre_pdc']             ?? ''),
        'type_prise'           => trim($_POST['type_prise']           ?? ''),
        'puissance_nominale'   => trim($_POST['puissance_nominale']   ?? ''),
        'date_mise_en_service' => trim($_POST['date_mise_en_service'] ?? ''),
        'lat'                  => trim($_POST['lat']                  ?? ''),
        'lng'                  => trim($_POST['lng']                  ?? ''),
    ];

    // Validation des champs obligatoires
    if ($champs['nom_amenageur'] === '') {
        $erreur = 'Le champ « Nom aménageur » est obligatoire.';
    } elseif ($champs['nom_operateur'] === '') {
        $erreur = 'Le champ « Nom opérateur » est obligatoire.';
    } elseif ($champs['nom_commune'] === '') {
        $erreur = 'Le champ « Commune » est obligatoire.';
    } elseif ($champs['nbre_pdc'] === '' || (int)$champs['nbre_pdc'] < 1) {
        $erreur = 'Le champ « Nombre de PDC » est obligatoire (minimum 1).';
    } elseif ($champs['type_prise'] === '') {
        $erreur = 'Le champ « Type de prise » est obligatoire.';
    }

    // Si tout est valide → insertion en base puis redirection
    if ($erreur === '') {
        // Construit le tableau de données attendu par IRVEModel::create()
        $data = [
            'nom_amenageur'        => $champs['nom_amenageur'],
            'siren_amenageur'      => $champs['siren_amenageur'],
            'contact_amenageur'    => $champs['contact_amenageur'],
            'nom_operateur'        => $champs['nom_operateur'],
            'nom_commune'          => $champs['nom_commune'],
            'nbre_pdc'             => (int)$champs['nbre_pdc'],
            'type_prise'           => $champs['type_prise'],
            'puissance_nominale'   => $champs['puissance_nominale'] !== '' ? (float)$champs['puissance_nominale'] : null,
            'date_mise_en_service' => $champs['date_mise_en_service'] !== '' ? $champs['date_mise_en_service'] : null,
            // Coordonnées au format "lng,lat" attendu par le modèle
            'coordonneesXY'        => ($champs['lng'] !== '' && $champs['lat'] !== '')
                                        ? $champs['lng'] . ',' . $champs['lat']
                                        : null,
        ];

        $model = new IRVEModel();
        $nouvel_id = $model->create($data);

        // Redirection vers le détail de la nouvelle installation
        header('Location: breizh_detail.php?id=' . $nouvel_id);
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Création – IRVE Breizh</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="breizh_style.css"/>
</head>
<body>

<!-- BARRE DE NAVIGATION DEMO -->
<div id="demo-nav">
  <span>Back-End</span>
  <a class="demo-btn" href="index.php">🏠 Accueil</a>
  <a class="demo-btn active" href="breizh_creation.php">➕ Création</a>
  <a class="demo-btn" href="breizh_detail.php">🔍 Détail</a>
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
      <a class="active">Ajouter</a>
    </nav>
  </header>

  <main>
    <section>
      <div class="section-layout">
        <div>
          <div class="section-title">Saisie d'un nouveau point de charge</div>
          <p style="font-size:13px;color:#aaa;margin-top:10px;">Remplissez les informations ci-contre pour ajouter une nouvelle installation.</p>
        </div>

        <!-- ====================================================
             FORMULAIRE DE CRÉATION
             Soumis en POST vers cette même page.
             En cas d'erreur, le formulaire est réaffiché avec
             les valeurs déjà saisies et le message d'erreur.
        ==================================================== -->
        <div class="form-wrap">
          <form method="POST" action="breizh_creation.php">

            <!-- Message d'erreur (visible uniquement si $erreur est non vide) -->
            <?php if ($erreur !== ''): ?>
              <div style="padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:14px;background:#fde8e8;color:#c0392b;">
                <?= e($erreur) ?>
              </div>
            <?php endif; ?>

            <div class="form-row">
              <div class="form-group">
                <label>Nom aménageur <span class="req">*</span></label>
                <input name="nom_amenageur" type="text" placeholder="ex : LE ROUX LOISIRS"
                       value="<?= e($champs['nom_amenageur'] ?? '') ?>"/>
              </div>
              <div class="form-group">
                <label>Siren aménageur</label>
                <input name="siren_amenageur" type="text" placeholder="ex : 453386120"
                       value="<?= e($champs['siren_amenageur'] ?? '') ?>"/>
              </div>
            </div>

            <div class="form-group">
              <label>Contact aménageur</label>
              <input name="contact_amenageur" type="email" placeholder="contact@example.com"
                     value="<?= e($champs['contact_amenageur'] ?? '') ?>"/>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Nom opérateur <span class="req">*</span></label>
                <input name="nom_operateur" type="text" placeholder="ex : freshmile"
                       value="<?= e($champs['nom_operateur'] ?? '') ?>"/>
              </div>
              <div class="form-group">
                <label>Type de prise <span class="req">*</span></label>
                <select name="type_prise">
                  <option value="">-- Sélectionner --</option>
                  <?php foreach (['T2', 'T3 (CCS)', 'CHAdeMO', 'EF'] as $option): ?>
                    <option <?= ($champs['type_prise'] ?? '') === $option ? 'selected' : '' ?>>
                      <?= e($option) ?>
                    </option>
                  <?php endforeach; ?>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Nombre de PDC <span class="req">*</span></label>
                <input name="nbre_pdc" type="number" placeholder="3" min="1"
                       value="<?= e($champs['nbre_pdc'] ?? '') ?>"/>
              </div>
              <div class="form-group">
                <label>Puissance nominale (kW)</label>
                <input name="puissance_nominale" type="number" placeholder="22" step="0.1"
                       value="<?= e($champs['puissance_nominale'] ?? '') ?>"/>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Commune <span class="req">*</span></label>
                <input name="nom_commune" type="text" placeholder="ex : Rennes"
                       value="<?= e($champs['nom_commune'] ?? '') ?>"/>
              </div>
              <div class="form-group">
                <label>Date de mise en service</label>
                <input name="date_mise_en_service" type="date"
                       value="<?= e($champs['date_mise_en_service'] ?? '') ?>"/>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Latitude</label>
                <input name="lat" type="number" placeholder="48.11726" step="0.00001"
                       value="<?= e($champs['lat'] ?? '') ?>"/>
              </div>
              <div class="form-group">
                <label>Longitude</label>
                <input name="lng" type="number" placeholder="-1.67792" step="0.00001"
                       value="<?= e($champs['lng'] ?? '') ?>"/>
              </div>
            </div>

            <div class="form-actions">
              <!-- Annuler = retour à la liste sans soumettre -->
              <a class="btn btn-outline" href="breizh_liste.php">Annuler</a>
              <button type="submit" class="btn btn-primary">Enregistrer l'installation</button>
            </div>

          </form>
        </div>
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
