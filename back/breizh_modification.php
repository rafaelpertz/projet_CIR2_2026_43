<?php
// ============================================================
//  breizh_modification.php — Modification ou suppression
//
//  Fonctionnement :
//    GET                  → charge les données de l'id et pré-remplit le formulaire
//    POST _action=update  → met à jour en base et redirige vers le détail
//    POST _action=delete  → demande confirmation (étape intermédiaire)
//    POST _action=delete_confirm → supprime en base et redirige vers la liste
//
//  Paramètre URL requis : ?id=X  (identifiant du PDC à modifier)
// ============================================================

require_once 'php/IRVEModel.php';

function e($valeur): string {
    return (string)($valeur ?? '');
}

$model = new IRVEModel();

// Récupère l'id depuis l'URL ou depuis un champ caché du formulaire
$id = isset($_GET['id'])  ? (int)$_GET['id']  :
     (isset($_POST['id']) ? (int)$_POST['id'] : 0);

$erreur          = '';     // Message d'erreur à afficher
$confirmer_suppr = false;  // Afficher la confirmation de suppression ?
$champs          = [];     // Valeurs du formulaire

// ---- Traitement POST ----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $action = $_POST['_action'] ?? '';

    // --- Mise à jour ---
    if ($action === 'update') {

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
        ];

        if ($champs['nom_amenageur'] === '') {
            $erreur = 'Le champ « Nom aménageur » est obligatoire.';
        }

        if ($erreur === '') {
            $data = [
                'nom_amenageur'        => $champs['nom_amenageur'],
                'siren_amenageur'      => $champs['siren_amenageur'],
                'contact_amenageur'    => $champs['contact_amenageur'],
                'nom_operateur'        => $champs['nom_operateur'],
                'nom_commune'          => $champs['nom_commune'],
                'nbre_pdc'             => (int)$champs['nbre_pdc'] ?: null,
                'type_prise'           => $champs['type_prise'],
                'puissance_nominale'   => $champs['puissance_nominale'] !== '' ? (float)$champs['puissance_nominale'] : null,
                'date_mise_en_service' => $champs['date_mise_en_service'] !== '' ? $champs['date_mise_en_service'] : null,
            ];
            $model->update($id, $data);

            // Redirection vers le détail après mise à jour réussie
            header('Location: breizh_detail.php?id=' . $id);
            exit;
        }
    }

    // --- Demande de confirmation de suppression ---
    if ($action === 'delete') {
        // On ne supprime pas encore : on affiche une demande de confirmation
        $confirmer_suppr = true;
    }

    // --- Suppression confirmée ---
    if ($action === 'delete_confirm') {
        $model->delete($id);

        // Redirection vers la liste après suppression
        header('Location: breizh_liste.php');
        exit;
    }
}

// ---- Chargement des données existantes (GET ou POST avec erreur) ----
// On charge l'item depuis la base seulement si $champs est vide
// (sinon on garde ce que l'utilisateur avait saisi)
$item = ($id > 0) ? $model->getById($id) : null;

if (empty($champs) && $item) {
    $champs = [
        'nom_amenageur'        => $item['nom_amenageur']        ?? '',
        'siren_amenageur'      => $item['siren_amenageur']      ?? '',
        'contact_amenageur'    => $item['contact_amenageur']    ?? '',
        'nom_operateur'        => $item['nom_operateur']        ?? '',
        'nom_commune'          => $item['nom_commune']          ?? '',
        'nbre_pdc'             => $item['nbre_pdc']             ?? '',
        'type_prise'           => $item['type_prise']           ?? '',
        'puissance_nominale'   => $item['puissance_nominale']   ?? '',
        'date_mise_en_service' => $item['date_mise_en_service'] ?? '',
    ];
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Modification – IRVE Breizh</title>
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
      <div class="section-layout">
        <div>
          <div class="section-title">Modifier un point de charge</div>
          <p style="font-size:13px;color:#aaa;margin-top:10px;">Modifiez les champs souhaités puis sauvegardez.</p>
        </div>

        <div class="form-wrap">

          <?php if (!$item && $id > 0): ?>
            <!-- L'id fourni ne correspond à rien en base -->
            <p style="color:#e74c3c;">Aucune installation trouvée pour l'identifiant <?= e($id) ?>.</p>
            <a class="btn btn-outline" href="breizh_liste.php">← Retour à la liste</a>

          <?php elseif (!$item): ?>
            <!-- Aucun id dans l'URL -->
            <p style="color:#aaa;">Aucun identifiant fourni. Accédez via la liste ou le détail.</p>
            <a class="btn btn-outline" href="breizh_liste.php">← Voir la liste</a>

          <?php else: ?>

            <!-- ================================================
                 CONFIRMATION DE SUPPRESSION
                 Affichée quand l'utilisateur clique "Supprimer"
            ================================================ -->
            <?php if ($confirmer_suppr): ?>
              <div style="padding:16px;background:#fde8e8;border-radius:8px;margin-bottom:20px;border:1px solid #fca5a5;">
                <p style="color:#c0392b;font-weight:600;margin-bottom:12px;">
                  Supprimer définitivement cette installation ?
                </p>
                <div style="display:flex;gap:10px;">
                  <!-- Confirme la suppression -->
                  <form method="POST" action="breizh_modification.php?id=<?= e($id) ?>" style="display:inline;">
                    <input type="hidden" name="id" value="<?= e($id) ?>"/>
                    <input type="hidden" name="_action" value="delete_confirm"/>
                    <button type="submit" class="btn" style="background:#c0392b;color:#fff;border:none;">
                      Oui, supprimer
                    </button>
                  </form>
                  <!-- Annule et retourne au formulaire -->
                  <a class="btn btn-outline" href="breizh_modification.php?id=<?= e($id) ?>">Non, annuler</a>
                </div>
              </div>
            <?php endif; ?>

            <!-- Message d'erreur de validation -->
            <?php if ($erreur !== ''): ?>
              <div style="padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:14px;background:#fde8e8;color:#c0392b;">
                <?= e($erreur) ?>
              </div>
            <?php endif; ?>

            <!-- ================================================
                 FORMULAIRE DE MODIFICATION
                 Soumis en POST avec _action=update
            ================================================ -->
            <form method="POST" action="breizh_modification.php?id=<?= e($id) ?>">
              <input type="hidden" name="id" value="<?= e($id) ?>"/>
              <input type="hidden" name="_action" value="update"/>

              <div class="form-row">
                <div class="form-group">
                  <label>Nom aménageur <span class="req">*</span></label>
                  <input name="nom_amenageur" type="text" placeholder="ex : LE ROUX LOISIRS"
                         value="<?= e($champs['nom_amenageur']) ?>"/>
                </div>
                <div class="form-group">
                  <label>Siren aménageur</label>
                  <input name="siren_amenageur" type="text" placeholder="ex : 453386120"
                         value="<?= e($champs['siren_amenageur']) ?>"/>
                </div>
              </div>

              <div class="form-group">
                <label>Contact aménageur</label>
                <input name="contact_amenageur" type="email" placeholder="ex : tech@domainependruc.com"
                       value="<?= e($champs['contact_amenageur']) ?>"/>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Nom opérateur</label>
                  <input name="nom_operateur" type="text" placeholder="ex : freshmile"
                         value="<?= e($champs['nom_operateur']) ?>"/>
                </div>
                <div class="form-group">
                  <label>Type de prise</label>
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
                  <label>Nombre de PDC</label>
                  <input name="nbre_pdc" type="number" placeholder="ex : 3"
                         value="<?= e($champs['nbre_pdc']) ?>"/>
                </div>
                <div class="form-group">
                  <label>Puissance (kW)</label>
                  <input name="puissance_nominale" type="number" placeholder="ex : 22" step="0.1"
                         value="<?= e($champs['puissance_nominale']) ?>"/>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Commune</label>
                  <input name="nom_commune" type="text" placeholder="ex : Rennes"
                         value="<?= e($champs['nom_commune']) ?>"/>
                </div>
                <div class="form-group">
                  <label>Date de mise en service</label>
                  <input name="date_mise_en_service" type="date"
                         value="<?= e($champs['date_mise_en_service']) ?>"/>
                </div>
              </div>

              <div class="form-actions" style="justify-content:space-between;">
                <div><!-- Le bouton Supprimer est dans son propre formulaire ci-dessous --></div>
                <div style="display:flex;gap:10px;">
                  <a class="btn btn-outline" href="breizh_detail.php?id=<?= e($id) ?>">Annuler</a>
                  <button type="submit" class="btn btn-primary">Enregistrer</button>
                </div>
              </div>

            </form>

            <!-- ================================================
                 FORMULAIRE DE SUPPRESSION (séparé du formulaire
                 de modification pour avoir une action distincte)
            ================================================ -->
            <form method="POST" action="breizh_modification.php?id=<?= e($id) ?>" style="margin-top:10px;">
              <input type="hidden" name="id" value="<?= e($id) ?>"/>
              <input type="hidden" name="_action" value="delete"/>
              <button type="submit" class="btn" style="background:#fde8e8;color:#c0392b;border:1px solid #fca5a5;">
                Supprimer
              </button>
            </form>

          <?php endif; ?>
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
