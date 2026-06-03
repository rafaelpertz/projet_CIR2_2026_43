<?php
/**
 * API REST — BreizhOhm
 * Routes :
 *   GET /api/amenageurs?limit=20&random=1
 *   GET /api/types-prise
 *   GET /api/departements
 *   GET /api/installations?amenageur=&prise=&dept=
 *   GET /api/installations/carte?annee=&dept=
 *   GET /api/installations/{id}
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// ── Routing ──────────────────────────────────────────────────
$uri    = $_SERVER['REQUEST_URI'];
$script = $_SERVER['SCRIPT_NAME'];          // /ProjetFinal/projet_CIR2_2026_43/api/index.php
$base   = dirname($script);                 // /ProjetFinal/projet_CIR2_2026_43/api
$path   = '/' . ltrim(substr(parse_url($uri, PHP_URL_PATH), strlen($base)), '/');

try {
    $pdo = getDB();

    // GET /amenageurs
    if ($path === '/amenageurs') {
        $limit  = isset($_GET['limit'])  ? (int)$_GET['limit']  : 0;
        $random = isset($_GET['random']) && $_GET['random'] == '1';

        $sql = 'SELECT id_amenageur AS id, nom_amenageur FROM amenageur WHERE nom_amenageur IS NOT NULL';
        if ($random) $sql .= ' ORDER BY RAND()';
        else         $sql .= ' ORDER BY nom_amenageur';
        if ($limit > 0) $sql .= " LIMIT $limit";

        echo json_encode($pdo->query($sql)->fetchAll());
        exit;
    }

    // GET /types-prise
    if ($path === '/types-prise') {
        $rows = $pdo->query(
            'SELECT id_type_prise AS id, libelle_type_prise AS libelle FROM type_prise ORDER BY libelle_type_prise'
        )->fetchAll();
        echo json_encode($rows);
        exit;
    }

    // GET /departements
    if ($path === '/departements') {
        $noms = [
            '22' => 'Côtes-d\'Armor',
            '29' => 'Finistère',
            '35' => 'Ille-et-Vilaine',
            '56' => 'Morbihan',
        ];
        $rows = $pdo->query(
            'SELECT DISTINCT code_dep FROM station WHERE code_dep IS NOT NULL ORDER BY code_dep'
        )->fetchAll(PDO::FETCH_COLUMN);

        $result = [];
        foreach ($rows as $code) {
            $result[] = [
                'code' => $code,
                'nom'  => isset($noms[$code]) ? $code . ' – ' . $noms[$code] : $code,
            ];
        }
        echo json_encode($result);
        exit;
    }

    // GET /installations/carte?annee=&dept=
    if ($path === '/installations/carte') {
        $params = [];
        $where  = [];

        if (!empty($_GET['annee'])) {
            $where[]  = 'YEAR(p.date_mise_service) = :annee';
            $params[':annee'] = (int)$_GET['annee'];
        }
        if (!empty($_GET['dept'])) {
            $where[]  = 's.code_dep = :dept';
            $params[':dept'] = $_GET['dept'];
        }

        $sql = '
            SELECT
                p.id_pdc                            AS id,
                s.latitude                          AS lat,
                s.longitude                         AS lon,
                s.nom_station                       AS commune,
                p.puissance_nominale,
                GROUP_CONCAT(tp.libelle_type_prise ORDER BY tp.libelle_type_prise SEPARATOR \', \') AS type_prise
            FROM pdc p
            JOIN station s       ON s.id_station_locale = p.id_station_locale
            LEFT JOIN pdc_type_prise ptp ON ptp.id_pdc = p.id_pdc
            LEFT JOIN type_prise tp      ON tp.id_type_prise = ptp.id_type_prise
            WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
        ';
        if ($where) $sql .= ' AND ' . implode(' AND ', $where);
        $sql .= ' GROUP BY p.id_pdc LIMIT 2000';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        echo json_encode($stmt->fetchAll());
        exit;
    }

    // GET /installations/{id}
    if (preg_match('#^/installations/(\d+)$#', $path, $m)) {
        $id   = (int)$m[1];
        $stmt = $pdo->prepare('
            SELECT
                p.id_pdc                            AS id,
                p.puissance_nominale,
                p.date_mise_service                 AS date_mise_en_service,
                p.gratuit,
                p.paiment_acte,
                p.paiment_cb,
                p.tarification,
                s.id_station_locale                 AS id_station,
                s.nom_station,
                s.adresse_station,
                s.code_dep                          AS code_dept,
                s.latitude                          AS coordonneesXY_lat,
                s.longitude                         AS coordonneesXY_lon,
                a.nom_amenageur,
                op.nom_operateur,
                e.nom_enseigne,
                h.horaires,
                ca.condition_acces                  AS acces_recharge,
                GROUP_CONCAT(tp.libelle_type_prise ORDER BY tp.libelle_type_prise SEPARATOR \', \') AS type_prise
            FROM pdc p
            JOIN station s            ON s.id_station_locale = p.id_station_locale
            LEFT JOIN amenageur a     ON a.id_amenageur  = s.id_amenageur
            LEFT JOIN operateur op    ON op.id_operateur = s.id_operateur
            LEFT JOIN enseigne e      ON e.id_enseigne   = s.id_enseigne
            LEFT JOIN horaires h      ON h.id_horaires   = p.id_horaires
            LEFT JOIN condition_d_acces ca ON ca.id_condition = p.id_condition
            LEFT JOIN pdc_type_prise ptp   ON ptp.id_pdc = p.id_pdc
            LEFT JOIN type_prise tp        ON tp.id_type_prise = ptp.id_type_prise
            WHERE p.id_pdc = :id
            GROUP BY p.id_pdc
        ');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) { http_response_code(404); echo json_encode(['error' => 'Not found']); exit; }
        // commune = nom_station (pas de champ commune dans la BDD)
        $row['commune'] = $row['nom_station'];
        echo json_encode($row);
        exit;
    }

    // GET /installations?amenageur=&prise=&dept=
    if ($path === '/installations') {
        $params = [];
        $where  = [];

        if (!empty($_GET['amenageur'])) {
            $where[]  = 's.id_amenageur = :amenageur';
            $params[':amenageur'] = (int)$_GET['amenageur'];
        }
        if (!empty($_GET['prise'])) {
            $where[]  = 'EXISTS (
                SELECT 1 FROM pdc_type_prise ptp2
                JOIN type_prise tp2 ON tp2.id_type_prise = ptp2.id_type_prise
                WHERE ptp2.id_pdc = p.id_pdc AND tp2.id_type_prise = :prise
            )';
            $params[':prise'] = (int)$_GET['prise'];
        }
        if (!empty($_GET['dept'])) {
            $where[]  = 's.code_dep = :dept';
            $params[':dept'] = $_GET['dept'];
        }

        $sql = '
            SELECT
                p.id_pdc                            AS id,
                p.date_mise_service                 AS date_mise_en_service,
                p.puissance_nominale,
                s.nom_station                       AS commune,
                s.code_dep                          AS code_dept,
                GROUP_CONCAT(tp.libelle_type_prise ORDER BY tp.libelle_type_prise SEPARATOR \', \') AS type_prise,
                1                                   AS nbre_pdc
            FROM pdc p
            JOIN station s            ON s.id_station_locale = p.id_station_locale
            LEFT JOIN pdc_type_prise ptp   ON ptp.id_pdc = p.id_pdc
            LEFT JOIN type_prise tp        ON tp.id_type_prise = ptp.id_type_prise
        ';
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        $sql .= ' GROUP BY p.id_pdc ORDER BY p.date_mise_service DESC LIMIT 500';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        echo json_encode($stmt->fetchAll());
        exit;
    }

    http_response_code(404);
    echo json_encode(['error' => 'Route not found', 'path' => $path]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
