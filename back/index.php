<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Accueil – IRVE Breizh</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="breizh_style.css"/>
  <!-- Aucun JavaScript : navigation via liens <a href="..."> -->
</head>
<body>

<!-- ============================================================
     BARRE DE NAVIGATION DEMO
     Chaque bouton est un lien <a> vers la page correspondante.
     La classe "active" est mise en dur sur la page courante.
============================================================ -->
<div id="demo-nav">
  <span>Back-End</span>
  <a class="demo-btn active" href="breizh_accueil.php">🏠 Accueil</a>
  <a class="demo-btn" href="breizh_creation.php">➕ Création</a>
  <a class="demo-btn" href="breizh_detail.php">🔍 Détail</a>
  <a class="demo-btn" href="breizh_liste.php">📋 Liste</a>
</div>

<div class="page-wrapper">
  <header>
    <div class="header-brand">
      <div class="header-logo">
        <img src="../assets/logo_breizh_charge_groupe43_v2.png" alt="Breizh Ohm"/>
      </div>
      <span class="brand-name">Breizh Ohm</span>
    </div>
    <nav>
      <a class="active" href="breizh_accueil.php">Accueil</a>
      <a href="breizh_liste.php">Liste</a>
      <a href="breizh_creation.php">Ajouter</a>
    </nav>
  </header>

  <main>
    <!-- HERO -->
    <div class="hero">
      <div class="hero-sphere"></div>
      <div class="hero-content">
        <h1>Envie d'ajouter / modifier les informations d'une borne de charge.</h1>
        <div class="hero-btns">
          <!-- Les boutons hero sont des liens déguisés en boutons -->
          <a class="btn-hero" href="breizh_creation.php">Ajouter un point de charge</a>
          <a class="btn-hero" href="breizh_modification.php">Modifier un point de charge</a>
        </div>
      </div>
    </div>
  </main>

  <footer>
    <div class="footer-brand">
      <div class="footer-logo"><img src="../assets/logo_breizh_charge_groupe43_v2.png" alt="Breizh Ohm"/></div>
      <div>
        <div class="footer-name">Breizh Ohm</div>
        <div style="font-size:10px;color:#555;margin-top:2px;">IRVE · CIN2 · 2026</div>
      </div>
    </div>
    <div class="footer-meta">
      <p>Florian Muller / Rafaël Touzé</p>
      <p>CIN2 2026 groupe 13</p>
    </div>
  </footer>
</div>

</body>
</html>
