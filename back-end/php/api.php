<?php
// ============================================================
//  api.php — Point d'entrée JSON pour toutes les opérations CRUD
//  Usage : php/api.php?action=<action>[&id=<id>]
// ============================================================

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/IRVEModel.php';

$action = $_GET['action'] ?? '';
$id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$model  = new IRVEModel();

try {
    switch ($action) {

        case 'liste':
            echo json_encode($model->getListe());
            break;

        case 'detail':
            $row = $model->getById($id);
            echo json_encode($row ?: null);
            break;

        case 'search':
            $nom = trim($_GET['nom'] ?? '');
            echo json_encode($model->searchByNom($nom));
            break;

        case 'create':
            $data  = json_decode(file_get_contents('php://input'), true) ?? [];
            $newId = $model->create($data);
            echo json_encode(['success' => true, 'id' => $newId]);
            break;

        case 'update':
            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            $ok   = $model->update($id, $data);
            echo json_encode(['success' => (bool)$ok]);
            break;

        case 'delete':
            $ok = $model->delete($id);
            echo json_encode(['success' => (bool)$ok]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Action inconnue']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
