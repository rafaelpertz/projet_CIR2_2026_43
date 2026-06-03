<?php
// ============================================================
//  /back/delete.php — Suppression d'une installation
//  Appelé depuis le bouton "Supprimer" de edit.php
// ============================================================

require_once __DIR__ . '/IRVEModel.php';

$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($id <= 0) {
    header('Location: index.php');
    exit;
}

try {
    $model = new IRVEModel();
    $model->delete($id);
} catch (PDOException $e) {
    // En cas d'erreur, retour à la liste avec message
    header('Location: index.php?error=' . urlencode($e->getMessage()));
    exit;
}

// Retour à la liste après suppression
header('Location: index.php?deleted=1');
exit;
