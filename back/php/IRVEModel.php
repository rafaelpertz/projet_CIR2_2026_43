<?php
// ============================================================
//  IRVEModel.php — Requêtes SQL sur la base normalisée (JOINs)
//  L'identifiant utilisé dans les URLs est id_pdc (entier).
// ============================================================

require_once __DIR__ . '/Database.php';

class IRVEModel {

    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    // ----------------------------------------------------------
    //  LISTE — 100 stations (groupées), avec données jointes
    // ----------------------------------------------------------
    public function getListe(): array {
        $sql = "
            SELECT
                MIN(p.id_pdc)   AS id,
                a.nom_amenageur,
                o.nom_operateur,
                s.nom_station   AS nom_commune,
                COUNT(DISTINCT p.id_pdc) AS nbre_pdc,
                GROUP_CONCAT(DISTINCT tp.libelle_type_prise
                             ORDER BY tp.libelle_type_prise
                             SEPARATOR ', ') AS type_prise,
                AVG(p.puissance_nominale) AS puissance_nominale
            FROM station s
            INNER JOIN pdc p             ON p.id_station_locale  = s.id_station_locale
            LEFT JOIN  amenageur a       ON s.id_amenageur        = a.id_amenageur
            LEFT JOIN  operateur o       ON s.id_operateur        = o.id_operateur
            LEFT JOIN  pdc_type_prise ptp ON ptp.id_pdc           = p.id_pdc
            LEFT JOIN  type_prise tp     ON tp.id_type_prise      = ptp.id_type_prise
            GROUP BY s.id_station_locale, a.nom_amenageur, o.nom_operateur, s.nom_station
            LIMIT 100
        ";
        $stmt = $this->db->query($sql);
        return $stmt->fetchAll();
    }

    // ----------------------------------------------------------
    //  DÉTAIL — Toutes les infos d'une installation via id_pdc
    // ----------------------------------------------------------
    public function getById(int $id): array|false {
        $sql = "
            SELECT
                p.id_pdc                        AS id,
                a.nom_amenageur,
                a.siren_amenageur,
                a.contact_amenageur,
                o.nom_operateur,
                o.contact_operateur,
                o.tel_operateur                 AS telephone_operateur,
                e.nom_enseigne,
                s.id_station_itinerance,
                s.nom_station                   AS nom_commune,
                s.adresse_station,
                s.code_insee,
                IF(s.longitude IS NOT NULL AND s.latitude IS NOT NULL,
                   CONCAT(s.longitude, ',', s.latitude),
                   NULL)                        AS coordonneesXY,
                (SELECT COUNT(*)
                   FROM pdc p2
                  WHERE p2.id_station_locale = s.id_station_locale) AS nbre_pdc,
                GROUP_CONCAT(DISTINCT tp.libelle_type_prise
                             ORDER BY tp.libelle_type_prise
                             SEPARATOR ', ')    AS type_prise,
                p.puissance_nominale,
                p.date_mise_service             AS date_mise_en_service,
                h.horaires,
                ca.condition_acces              AS acces_recharge
            FROM pdc p
            JOIN  station s               ON p.id_station_locale   = s.id_station_locale
            LEFT JOIN amenageur a         ON s.id_amenageur        = a.id_amenageur
            LEFT JOIN operateur o         ON s.id_operateur        = o.id_operateur
            LEFT JOIN enseigne e          ON s.id_enseigne         = e.id_enseigne
            LEFT JOIN pdc_type_prise ptp  ON ptp.id_pdc            = p.id_pdc
            LEFT JOIN type_prise tp       ON tp.id_type_prise      = ptp.id_type_prise
            LEFT JOIN horaires h          ON p.id_horaires         = h.id_horaires
            LEFT JOIN condition_d_acces ca ON p.id_condition       = ca.id_condition
            WHERE p.id_pdc = :id
            GROUP BY p.id_pdc
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        return $stmt->fetch();
    }

    // ----------------------------------------------------------
    //  CRÉATION — Transaction : amenageur → operateur → station → pdc(s)
    //  Retourne l'id_pdc du premier PDC créé.
    // ----------------------------------------------------------
    public function create(array $data): int {
        $this->db->beginTransaction();
        try {
            // 1. Aménageur
            $stmt = $this->db->prepare(
                "INSERT INTO amenageur (nom_amenageur, siren_amenageur, contact_amenageur)
                 VALUES (:nom, :siren, :contact)"
            );
            $stmt->execute([
                ':nom'     => $data['nom_amenageur'],
                ':siren'   => !empty($data['siren_amenageur']) ? (int) $data['siren_amenageur'] : null,
                ':contact' => $data['contact_amenageur'] ?? null,
            ]);
            $id_amenageur = (int) $this->db->lastInsertId();

            // 2. Opérateur
            $stmt = $this->db->prepare(
                "INSERT INTO operateur (nom_operateur) VALUES (:nom)"
            );
            $stmt->execute([':nom' => $data['nom_operateur']]);
            $id_operateur = (int) $this->db->lastInsertId();

            // 3. Station
            $id_station_locale = 'STA-' . uniqid();
            [$lng, $lat]       = $this->parseCoords($data['coordonneesXY'] ?? '');
            $stmt = $this->db->prepare(
                "INSERT INTO station
                     (id_station_locale, nom_station, adresse_station,
                      code_insee, longitude, latitude, id_amenageur, id_operateur)
                 VALUES (:id_sl, :nom, :adresse, :code_insee, :lng, :lat, :id_a, :id_o)"
            );
            $stmt->execute([
                ':id_sl'      => $id_station_locale,
                ':nom'        => $data['nom_commune'],
                ':adresse'    => $data['nom_commune'],
                ':code_insee' => $data['code_insee'] ?? null,
                ':lng'        => $lng,
                ':lat'        => $lat,
                ':id_a'       => $id_amenageur,
                ':id_o'       => $id_operateur,
            ]);

            // 4. PDC — on crée autant de lignes que nbre_pdc
            $nbre = max(1, (int) ($data['nbre_pdc'] ?? 1));
            $stmt = $this->db->prepare(
                "INSERT INTO pdc (puissance_nominale, date_mise_service, id_station_locale)
                 VALUES (:puissance, :date, :id_sl)"
            );
            $firstPdcId = null;
            for ($i = 0; $i < $nbre; $i++) {
                $stmt->execute([
                    ':puissance' => !empty($data['puissance_nominale']) ? (float) $data['puissance_nominale'] : null,
                    ':date'      => !empty($data['date_mise_en_service']) ? $data['date_mise_en_service'] : null,
                    ':id_sl'     => $id_station_locale,
                ]);
                if ($firstPdcId === null) {
                    $firstPdcId = (int) $this->db->lastInsertId();
                }
            }

            // 5. Type de prise sur le premier PDC
            $this->linkTypePrise($firstPdcId, $data['type_prise'] ?? '');

            $this->db->commit();
            return $firstPdcId;

        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    // ----------------------------------------------------------
    //  MODIFICATION — Met à jour amenageur, operateur, station
    //  et tous les PDC de la station via id_pdc
    // ----------------------------------------------------------
    public function update(int $id, array $data): bool {
        $this->db->beginTransaction();
        try {
            // Retrouver la station et ses FK à partir de l'id_pdc
            $stmt = $this->db->prepare(
                "SELECT s.id_station_locale, s.id_amenageur, s.id_operateur
                 FROM pdc p
                 JOIN station s ON p.id_station_locale = s.id_station_locale
                 WHERE p.id_pdc = :id"
            );
            $stmt->execute([':id' => $id]);
            $row = $stmt->fetch();
            if (!$row) {
                $this->db->rollBack();
                return false;
            }

            // Update aménageur
            $stmt = $this->db->prepare(
                "UPDATE amenageur
                 SET nom_amenageur = :nom, siren_amenageur = :siren, contact_amenageur = :contact
                 WHERE id_amenageur = :id"
            );
            $stmt->execute([
                ':nom'     => $data['nom_amenageur'],
                ':siren'   => !empty($data['siren_amenageur']) ? (int) $data['siren_amenageur'] : null,
                ':contact' => $data['contact_amenageur'] ?? null,
                ':id'      => $row['id_amenageur'],
            ]);

            // Update opérateur
            $stmt = $this->db->prepare(
                "UPDATE operateur SET nom_operateur = :nom WHERE id_operateur = :id"
            );
            $stmt->execute([
                ':nom' => $data['nom_operateur'],
                ':id'  => $row['id_operateur'],
            ]);

            // Update station
            $stmt = $this->db->prepare(
                "UPDATE station SET nom_station = :nom, code_insee = :code
                 WHERE id_station_locale = :id"
            );
            $stmt->execute([
                ':nom'  => $data['nom_commune'],
                ':code' => $data['code_insee'] ?? null,
                ':id'   => $row['id_station_locale'],
            ]);

            // Update tous les PDC de la station (puissance + date)
            $stmt = $this->db->prepare(
                "UPDATE pdc
                 SET puissance_nominale = :puissance, date_mise_service = :date
                 WHERE id_station_locale = :id_sl"
            );
            $stmt->execute([
                ':puissance' => !empty($data['puissance_nominale']) ? (float) $data['puissance_nominale'] : null,
                ':date'      => !empty($data['date_mise_en_service']) ? $data['date_mise_en_service'] : null,
                ':id_sl'     => $row['id_station_locale'],
            ]);

            // Mise à jour du type de prise sur le PDC ciblé
            $this->db->prepare("DELETE FROM pdc_type_prise WHERE id_pdc = :id")
                     ->execute([':id' => $id]);
            $this->linkTypePrise($id, $data['type_prise'] ?? '');

            $this->db->commit();
            return true;

        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    // ----------------------------------------------------------
    //  SUPPRESSION — Supprime la station, tous ses PDC et l'amenageur
    //  (CASCADE FK : station → pdc → pdc_type_prise)
    // ----------------------------------------------------------
    public function delete(int $id): bool {
        $this->db->beginTransaction();
        try {
            // Trouver la station et son amenageur à partir du PDC ciblé
            $stmt = $this->db->prepare(
                "SELECT s.id_station_locale, s.id_amenageur
                 FROM pdc p
                 JOIN station s ON p.id_station_locale = s.id_station_locale
                 WHERE p.id_pdc = :id"
            );
            $stmt->execute([':id' => $id]);
            $row = $stmt->fetch();
            if (!$row) {
                $this->db->rollBack();
                return false;
            }

            $id_amenageur = $row['id_amenageur'];

            // Supprimer la station → cascade sur tous ses PDC et pdc_type_prise
            $this->db->prepare("DELETE FROM station WHERE id_station_locale = :id_sl")
                     ->execute([':id_sl' => $row['id_station_locale']]);

            // Supprimer l'amenageur s'il n'est plus lié à aucune autre station
            if ($id_amenageur !== null) {
                $cnt = $this->db->prepare(
                    "SELECT COUNT(*) FROM station WHERE id_amenageur = :id_a"
                );
                $cnt->execute([':id_a' => $id_amenageur]);
                if ((int) $cnt->fetchColumn() === 0) {
                    $this->db->prepare("DELETE FROM amenageur WHERE id_amenageur = :id_a")
                             ->execute([':id_a' => $id_amenageur]);
                }
            }

            $this->db->commit();
            return true;

        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    // ----------------------------------------------------------
    //  RECHERCHE — Par nom d'aménageur (LIKE)
    // ----------------------------------------------------------
    public function searchByNom(string $nom): array {
        $sql = "
            SELECT
                MIN(p.id_pdc)   AS id,
                a.nom_amenageur,
                a.siren_amenageur,
                a.contact_amenageur,
                o.nom_operateur,
                s.nom_station   AS nom_commune
            FROM station s
            INNER JOIN pdc p       ON p.id_station_locale = s.id_station_locale
            LEFT JOIN  amenageur a ON s.id_amenageur      = a.id_amenageur
            LEFT JOIN  operateur o ON s.id_operateur      = o.id_operateur
            WHERE a.nom_amenageur LIKE :nom
            GROUP BY s.id_station_locale, a.nom_amenageur, a.siren_amenageur,
                     a.contact_amenageur, o.nom_operateur, s.nom_station
            LIMIT 50
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':nom' => '%' . $nom . '%']);
        return $stmt->fetchAll();
    }

    // ----------------------------------------------------------
    //  Helpers privés
    // ----------------------------------------------------------

    // Trouve ou crée le type_prise et le lie au PDC donné
    private function linkTypePrise(int $id_pdc, string $libelle): void {
        if (empty($libelle)) return;

        $stmt = $this->db->prepare(
            "SELECT id_type_prise FROM type_prise WHERE libelle_type_prise = :lib"
        );
        $stmt->execute([':lib' => $libelle]);
        $id_tp = $stmt->fetchColumn();

        if (!$id_tp) {
            $ins = $this->db->prepare(
                "INSERT INTO type_prise (libelle_type_prise) VALUES (:lib)"
            );
            $ins->execute([':lib' => $libelle]);
            $id_tp = (int) $this->db->lastInsertId();
        }

        $this->db->prepare(
            "INSERT IGNORE INTO pdc_type_prise (id_pdc, id_type_prise) VALUES (:id_pdc, :id_tp)"
        )->execute([':id_pdc' => $id_pdc, ':id_tp' => $id_tp]);
    }

    // Parse "lng,lat" → [$lng, $lat] ou [null, null]
    private function parseCoords(string $coords): array {
        if (empty($coords)) return [null, null];
        $parts = explode(',', $coords, 2);
        if (count($parts) === 2) {
            return [(float) trim($parts[0]), (float) trim($parts[1])];
        }
        return [null, null];
    }
}
