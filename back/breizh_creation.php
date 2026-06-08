<?php
// ============================================================
//  breizh_creation.php — Ajout d'une nouvelle installation
//
//  Fonctionnement :
//    GET → affiche le formulaire vide
//    La soumission est gérée côté client via fetch (POST /api/installations)
//    conformément à l'architecture REST du cahier des charges.
// ============================================================

// Échappe les caractères HTML pour affichage sécurisé
function e($val) {
    return htmlspecialchars((string)$val, ENT_QUOTES, 'UTF-8');
}

// URL de base de l'API (calculée dynamiquement pour tous les environnements)
$apiBase = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/') . '/api';
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
  <img src="../assets/logo_breizh_charge_groupe43_v2.png" alt="Breizh Ohm" style="width:26px;height:26px;object-fit:contain;"/>
  <span class="brand-name" style="font-size:14px;margin-right:10px;">Breizh Ohm</span>
  <span>Back-End</span>
  <a class="demo-btn" href="index.php">🏠 Accueil</a>
  <a class="demo-btn active" href="breizh_creation.php">➕ Création</a>
  <a class="demo-btn" href="breizh_detail.php">🔍 Détail</a>
  <a class="demo-btn" href="breizh_liste.php">📋 Liste</a>
</div>

<div class="page-wrapper">

  <main>
    <section>
      <div class="section-layout">
        <div>
          <div class="section-title">Saisie d'un nouveau point de charge</div>
          <p style="font-size:13px;color:#aaa;margin-top:10px;">Remplissez les informations ci-contre pour ajouter une nouvelle installation.</p>
        </div>

        <!-- ====================================================
             FORMULAIRE DE CRÉATION
             Soumis via fetch → POST /api/installations (REST)
        ==================================================== -->
        <div class="form-wrap">
          <form id="form-creation" method="POST" action="breizh_creation.php">

            <!-- Message d'erreur (injecté par JS) -->
            <div id="msg-erreur" style="display:none;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:14px;background:#fde8e8;color:#c0392b;"></div>

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
                <label>Contact opérateur</label>
                <input name="contact_operateur" type="email" placeholder="contact@operateur.com"
                       value="<?= e($champs['contact_operateur'] ?? '') ?>"/>
              </div>
              <div class="form-group">
                <label>Téléphone opérateur</label>
                <input name="tel_operateur" type="tel" placeholder="ex : +33 2 99 00 00 00"
                       value="<?= e($champs['tel_operateur'] ?? '') ?>"/>
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
                <label>Date de mise en service</label>
                <input name="date_mise_en_service" type="date"
                       value="<?= e($champs['date_mise_en_service'] ?? '') ?>"/>
              </div>
              <div class="form-group">
                <label>Condition d'accès</label>
                <input name="acces_recharge" type="text" placeholder="ex : Accès libre"
                       value="<?= e($champs['acces_recharge'] ?? '') ?>"/>
              </div>
            </div>

            <div class="form-group">
              <label>ID station itinérance</label>
              <input name="id_station_itinerance" type="text" placeholder="ex : FR*P62*S0001"
                     value="<?= e($champs['id_station_itinerance'] ?? '') ?>"/>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Commune <span class="req">*</span></label>
                <input name="nom_commune" type="text" placeholder="ex : Rennes"
                       value="<?= e($champs['nom_commune'] ?? '') ?>"/>
              </div>
              <div class="form-group">
                <label>Code INSEE</label>
                <input name="code_insee" type="text" placeholder="ex : 35238"
                       value="<?= e($champs['code_insee'] ?? '') ?>"/>
              </div>
            </div>

            <div class="form-group">
              <label>Adresse station</label>
              <input name="adresse_station" type="text" placeholder="ex : 12 rue de la Paix"
                     value="<?= e($champs['adresse_station'] ?? '') ?>"/>
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
              <a class="btn btn-outline" href="breizh_liste.php">Annuler</a>
              <button type="submit" class="btn btn-primary" id="btn-submit">Enregistrer l'installation</button>
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

<script>
// URL de l'API injectée par PHP
const API_BASE = '<?= $apiBase ?>';

document.getElementById('form-creation').addEventListener('submit', async function (e) {
    e.preventDefault();

    const msgErreur = document.getElementById('msg-erreur');
    const btn       = document.getElementById('btn-submit');
    msgErreur.style.display = 'none';

    // Lecture des champs
    const get = id => document.querySelector('[name="' + id + '"]')?.value?.trim() ?? '';

    // Validation côté client
    if (!get('nom_amenageur'))                       return afficherErreur('Le champ « Nom aménageur » est obligatoire.');
    if (!get('nom_operateur'))                       return afficherErreur('Le champ « Nom opérateur » est obligatoire.');
    if (!get('nom_commune'))                         return afficherErreur('Le champ « Commune » est obligatoire.');
    if (!get('nbre_pdc') || parseInt(get('nbre_pdc')) < 1) return afficherErreur('Le champ « Nombre de PDC » est obligatoire (minimum 1).');
    if (!get('type_prise'))                          return afficherErreur('Le champ « Type de prise » est obligatoire.');

    // Construction du payload
    const lat = get('lat'), lng = get('lng');
    const payload = {
        nom_amenageur:         get('nom_amenageur'),
        siren_amenageur:       get('siren_amenageur')       || null,
        contact_amenageur:     get('contact_amenageur')     || null,
        nom_operateur:         get('nom_operateur'),
        contact_operateur:     get('contact_operateur')     || null,
        tel_operateur:         get('tel_operateur')         || null,
        id_station_itinerance: get('id_station_itinerance') || null,
        nom_commune:           get('nom_commune'),
        adresse_station:       get('adresse_station')       || null,
        code_insee:            get('code_insee')            || null,
        nbre_pdc:              parseInt(get('nbre_pdc')),
        type_prise:            get('type_prise'),
        puissance_nominale:    get('puissance_nominale')    ? parseFloat(get('puissance_nominale')) : null,
        date_mise_en_service:  get('date_mise_en_service')  || null,
        acces_recharge:        get('acces_recharge')        || null,
        coordonneesXY:         (lng && lat) ? lng + ',' + lat : null,
    };

    btn.disabled = true;
    btn.textContent = 'Enregistrement…';

    try {
        // POST /api/installations — conforme REST (ajout de données)
        const resp = await fetch(API_BASE + '/installations', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        });

        const json = await resp.json();

        if (!resp.ok || !json.success) {
            afficherErreur(json.error ?? 'Erreur lors de l\'enregistrement.');
        } else {
            // Redirection vers le détail de la nouvelle installation
            window.location.href = 'breizh_detail.php?id=' + json.id;
        }
    } catch (err) {
        afficherErreur('Impossible de contacter l\'API : ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enregistrer l\'installation';
    }

    function afficherErreur(msg) {
        msgErreur.textContent = msg;
        msgErreur.style.display = 'block';
        msgErreur.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});
</script>
</body>
</html>
