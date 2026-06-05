<!--
    index.php — Page d'accueil du back-office IRVE Breizh
    =====================================================
    Rôle   : Point d'entrée du back-office. Présente une page hero
             avec deux actions principales : ajouter ou modifier une
             borne de recharge électrique (IRVE).

    Navigation : Entièrement via liens <a href="..."> — aucun JavaScript.
    Auteurs    : Florian Muller / Rafaël Touzé
    Projet     : CIN2 2026 · Groupe 43
-->
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Accueil – IRVE Breizh</title>
  <!-- Polices Google : Inter (interface) + Playfair Display (titres) -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet"/>
  <!-- Feuille de style commune à toutes les pages back-office -->
  <link rel="stylesheet" href="breizh_style.css"/>
</head>
<body>

<div id="demo-nav">
  <img src="../assets/logo_breizh_charge_groupe43_v2.png" alt="Breizh Ohm" style="width:26px;height:26px;object-fit:contain;"/>
  <span class="brand-name" style="font-size:14px;margin-right:10px;">Breizh Ohm</span>
  <span>Back-End</span>
  <a class="demo-btn active" href="index.php">🏠 Accueil</a>
  <a class="demo-btn" href="breizh_creation.php">➕ Création</a>
  <a class="demo-btn" href="breizh_detail.php">🔍 Détail</a>
  <a class="demo-btn" href="breizh_liste.php">📋 Liste</a>
</div>

<!-- Conteneur principal — flex column pour coller le footer en bas -->
<div class="page-wrapper">

  <main style="display:flex; flex-direction:column;">

    <!-- ============================================================
         SECTION HERO
         Bandeau pleine largeur avec dégradé et sphère décorative.
         Les deux boutons sont des <a> stylisés (pas de <button>)
         pour éviter tout besoin de JavaScript.
    ============================================================ -->
    <div class="hero" style="flex:1;">
      <!-- Sphère décorative positionnée en absolu via CSS -->
      <div class="hero-sphere"></div>

      <div class="hero-content">
        <h1>Envie d'ajouter / modifier les informations d'une borne de charge.</h1>

        <!-- Boutons d'action principaux — liens vers les formulaires CRUD -->
        <div class="hero-btns">
          <a class="btn-hero" href="breizh_creation.php">Ajouter un point de charge</a>
          <a class="btn-hero" href="breizh_modification.php">Modifier un point de charge</a>
        </div>
      </div>
    </div>

  </main>

  <!-- ============================================================
       FOOTER — Informations du projet
  ============================================================ -->
  <footer>
    <div class="footer-brand">
      <div class="footer-logo">
        <img src="../assets/logo_breizh_charge_groupe43_v2.png" alt="Breizh Ohm"/>
      </div>
      <div>
        <div class="footer-name">Breizh Ohm</div>
        <div style="font-size:10px;color:rgba(90,45,20,0.6);margin-top:2px;">IRVE · CIN2 · 2026</div>
      </div>
    </div>
    <div class="footer-meta">
      <p>Florian Muller / Rafaël Touzé</p>
      <p>CIN2 2026 groupe 13</p>
    </div>
  </footer>

</div><!-- /.page-wrapper -->

</body>
</html>
