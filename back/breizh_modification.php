<?php
// ============================================================
//  breizh_modification.php — Modification ou suppression
//
//  Fonctionnement :
//    GET → charge les données du PDC et pré-remplit le formulaire
//    La modification appelle PUT  /api/installations/{id} (REST)
//    La suppression appelle DELETE /api/installations/{id} (REST)
//
//  Paramètre URL requis : ?id=X  (identifiant du PDC à modifier)
// ============================================================

require_once 'php/IRVEModel.php';

function e($valeur): string {
    return (string)($valeur ?? '');
}

$model   = new IRVEModel();
$apiBase = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/') . '/api';

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

// Chargement des données existantes (GET uniquement)
$item   = ($id > 0) ? $model->getById($id) : null;
$champs = [];
if ($item) {
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
  <img src="../assets/logo_breizh_charge_groupe43_v2.png" alt="Breizh Ohm" style="width:26px;height:26px;object-fit:contain;"/>
  <span class="brand-name" style="font-size:14px;margin-right:10px;">Breizh Ohm</span>
  <span>Back-End</span>
  <a class="demo-btn" href="index.php">🏠 Accueil</a>
  <a class="demo-btn" href="breizh_creation.php">➕ Création</a>
  <a class="demo-btn" href="breizh_detail.php">🔍 Détail</a>
  <a class="demo-btn" href="breizh_liste.php">📋 Liste</a>
</div>

<div class="page-wrapper">

  <main>
    <section>
      <div class="section-layout">
        <div>
          <div class="section-title">Modifier un point de charge</div>
          <p style="font-size:13px;color:#aaa;margin-top:10px;">Modifiez les champs souhaités puis sauvegardez.</p>
        </div>

        <div class="form-wrap">

          <?php if (!$item && $id > 0): ?>
            <p style="color:#e74c3c;">Aucune installation trouvée pour l'identifiant <?= e($id) ?>.</p>
            <a class="btn btn-outline" href="breizh_liste.php">← Retour à la liste</a>

          <?php elseif (!$item): ?>
            <p style="color:#aaa;">Aucun identifiant fourni. Accédez via la liste ou le détail.</p>
            <a class="btn btn-outline" href="breizh_liste.php">← Voir la liste</a>

          <?php else: ?>

            <!-- Confirmation de suppression (affichée/masquée par JS) -->
            <div id="confirm-suppr" style="display:none;padding:16px;background:#fde8e8;border-radius:8px;margin-bottom:20px;border:1px solid #fca5a5;">
              <p style="color:#c0392b;font-weight:600;margin-bottom:12px;">Supprimer définitivement cette installation ?</p>
              <div style="display:flex;gap:10px;">
                <button id="btn-confirm-delete" class="btn" style="background:#c0392b;color:#fff;border:none;">Oui, supprimer</button>
                <button id="btn-annuler-delete" class="btn btn-outline" type="button">Non, annuler</button>
              </div>
            </div>

            <!-- Message d'erreur (injecté par JS) -->
            <div id="msg-erreur" style="display:none;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:14px;background:#fde8e8;color:#c0392b;"></div>

            <!-- ================================================
                 FORMULAIRE DE MODIFICATION
                 Soumis via fetch → PUT /api/installations/{id}
            ================================================ -->
            <form id="form-modif" method="POST" action="#">

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
                <!-- Bouton Supprimer : déclenche la confirmation via JS -->
                <button id="btn-supprimer" type="button" class="btn" style="background:#fde8e8;color:#c0392b;border:1px solid #fca5a5;">
                  Supprimer
                </button>
                <div style="display:flex;gap:10px;">
                  <a class="btn btn-outline" href="breizh_detail.php?id=<?= e($id) ?>">Annuler</a>
                  <button type="submit" id="btn-enregistrer" class="btn btn-primary">Enregistrer</button>
                </div>
              </div>

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

<script>
const API_BASE    = '<?= $apiBase ?>';
const RECORD_ID   = <?= (int)$id ?>;
const msgErreur   = document.getElementById('msg-erreur');
const confirmBox  = document.getElementById('confirm-suppr');

// ── Modification : PUT /api/installations/{id} ────────────────
const formModif = document.getElementById('form-modif');
if (formModif) {
    formModif.addEventListener('submit', async function (e) {
        e.preventDefault();
        msgErreur.style.display = 'none';

        const get = name => document.querySelector('[name="' + name + '"]')?.value?.trim() ?? '';

        if (!get('nom_amenageur')) return afficherErreur('Le champ « Nom aménageur » est obligatoire.');

        const payload = {
            nom_amenageur:        get('nom_amenageur'),
            siren_amenageur:      get('siren_amenageur')      || null,
            contact_amenageur:    get('contact_amenageur')    || null,
            nom_operateur:        get('nom_operateur'),
            nom_commune:          get('nom_commune'),
            nbre_pdc:             parseInt(get('nbre_pdc'))   || null,
            type_prise:           get('type_prise'),
            puissance_nominale:   get('puissance_nominale')   ? parseFloat(get('puissance_nominale')) : null,
            date_mise_en_service: get('date_mise_en_service') || null,
        };

        const btn = document.getElementById('btn-enregistrer');
        btn.disabled = true;
        btn.textContent = 'Enregistrement…';

        try {
            // PUT /api/installations/{id} — conforme REST (modification)
            const resp = await fetch(API_BASE + '/installations/' + RECORD_ID, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload),
            });
            const json = await resp.json();

            if (!resp.ok || !json.success) {
                afficherErreur(json.error ?? 'Erreur lors de la mise à jour.');
            } else {
                window.location.href = 'breizh_detail.php?id=' + RECORD_ID;
            }
        } catch (err) {
            afficherErreur('Impossible de contacter l\'API : ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Enregistrer';
        }
    });
}

// ── Suppression : DELETE /api/installations/{id} ──────────────
const btnSuppr = document.getElementById('btn-supprimer');
if (btnSuppr) {
    // Étape 1 : afficher la confirmation
    btnSuppr.addEventListener('click', () => {
        confirmBox.style.display = 'block';
        confirmBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}

const btnAnnulerDelete = document.getElementById('btn-annuler-delete');
if (btnAnnulerDelete) {
    btnAnnulerDelete.addEventListener('click', () => { confirmBox.style.display = 'none'; });
}

const btnConfirmDelete = document.getElementById('btn-confirm-delete');
if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', async () => {
        btnConfirmDelete.disabled = true;
        btnConfirmDelete.textContent = 'Suppression…';

        try {
            // DELETE /api/installations/{id} — conforme REST (suppression)
            const resp = await fetch(API_BASE + '/installations/' + RECORD_ID, {
                method: 'DELETE',
            });
            const json = await resp.json();

            if (!resp.ok || !json.success) {
                confirmBox.style.display = 'none';
                afficherErreur(json.error ?? 'Erreur lors de la suppression.');
            } else {
                window.location.href = 'breizh_liste.php';
            }
        } catch (err) {
            afficherErreur('Impossible de contacter l\'API : ' + err.message);
        }
    });
}

function afficherErreur(msg) {
    msgErreur.textContent = msg;
    msgErreur.style.display = 'block';
    msgErreur.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
</script>
</body>
</html>
