<?php
// ============================================================
//  includes/header.php — En-tête commun à toutes les pages back
//  Inclure avec : include __DIR__ . '/includes/header.php';
// ============================================================

// Détermination de la page active pour surligner le bon lien du menu
$currentPage = basename($_SERVER['PHP_SELF']); // ex: "index.php", "create.php"
$isActive = fn(string $page) => $currentPage === $page ? 'active' : '';
?>
<header class="site-header">
  <div class="header-brand">
    <div class="header-logo">🛡</div>
    <span class="brand-name">Breizh</span>
    <span class="badge-back">BACK-END</span>
  </div>
  <nav>
    <a href="index.php"  class="<?= $isActive('index.php') ?>">Accueil</a>
    <a href="index.php"  class="<?= $isActive('liste.php') ?>">Liste</a>
    <a href="create.php" class="<?= $isActive('create.php') ?>">+ Ajouter</a>
  </nav>
</header>
