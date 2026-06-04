<?php
// ============================================================
//  IRVEModel.php — Couche d'accès aux données (modèle MVC)
//
//  Responsabilité : toutes les requêtes SQL sur la base IRVE
//  normalisée (tables station, pdc, amenageur, operateur, …).
//
//  Schéma simplifié :
//    amenageur ──┐
//    operateur ──┤── station ──┬── pdc ──── pdc_type_prise ── type_prise
//    enseigne  ──┘             └── (coordonnées GPS)
//
//  L'identifiant exposé dans les URLs est id_pdc (entier auto).
//  Un même groupe station/aménageur peut avoir plusieurs PDC.
// ============================================================

require_once __DIR__ . '/Database.php';

class IRVEModel {

    /** Connexion PDO partagée via le singleton Database */
    private PDO $db;

    /**
     * Le constructeur récupère la connexion PDO depuis le singleton.
     * On ne stocke pas les credentials ici : tout est dans Database.php.
     */
    public function __construct() {
        $this->db = Database::getConnection();
    }

    // ----------------------------------------------------------
    //  LISTE — 100 stations groupées avec données jointes
    //
    //  Stratégie : on groupe par station pour éviter N lignes par
    //  PDC. MIN(id_pdc) donne un id stable pour les liens détail.
    //  GROUP_CONCAT agrège tous les types de prise de la station
    //  en une seule chaîne lisible ("Type 2, CCS, CHAdeMO"…).
    //  AVG(puissance) est une approximation ; dans les données
    //  réelles tous les PDC d'une station ont souvent la même.
    //  LIMIT 100 : protection contre un SELECT * massif.
    // ----------------------------------------------------------
    public function getListe(): array {
        $sql = "
            SELECT
                MIN(p.id_pdc)   AS id,            -- id représentatif du groupe
                a.nom_amenageur,
                o.nom_operateur,
                s.nom_station   AS nom_commune,
                COUNT(DISTINCT p.id_pdc) AS nbre_pdc,   -- nombre de bornes sur la station
                GROUP_CONCAT(DISTINCT tp.libelle_type_prise
                             ORDER BY tp.libelle_type_prise
                             SEPARATOR ', ') AS type_prise, -- ex: 'CCS, Type 2'
                AVG(p.puissance_nominale) AS puissance_nominale
            FROM station s
            -- INNER JOIN : on ne veut que les stations qui ont au moins un PDC
            INNER JOIN pdc p             ON p.id_station_locale  = s.id_station_locale
            -- LEFT JOIN : amenageur/operateur peuvent être NULL (données incomplètes)
            LEFT JOIN  amenageur a       ON s.id_amenageur        = a.id_amenageur
            LEFT JOIN  operateur o       ON s.id_operateur        = o.id_operateur
            -- Deux jointures pour la table de liaison N:N pdc ↔ type_prise
            LEFT JOIN  pdc_type_prise ptp ON ptp.id_pdc           = p.id_pdc
            LEFT JOIN  type_prise tp     ON tp.id_type_prise      = ptp.id_type_prise
            GROUP BY s.id_station_locale, a.nom_amenageur, o.nom_operateur, s.nom_station
            LIMIT 100
        ";
        $stmt = $this->db->query($sql);   // pas de paramètre : query() suffit
        return $stmt->fetchAll();          // tableau indexé + associatif (PDO::FETCH_BOTH par défaut)
    }

    // ----------------------------------------------------------
    //  DÉTAIL — Toutes les colonnes d'une borne via son id_pdc
    //
    //  Retourne false si l'id n'existe pas (le contrôleur gère
    //  le cas 404).
    //
    //  IF(longitude IS NOT NULL …) : on reconstruit la chaîne
    //  "lng,lat" attendue par le formulaire front-end pour
    //  préremplir le champ coordonneesXY.
    //
    //  Sous-requête COUNT(*) pour nbre_pdc : plus précis qu'un
    //  COUNT(DISTINCT) dans le GROUP BY, car on compte vraiment
    //  toutes les bornes de la station, pas seulement celles
    //  jointes à un type de prise.
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
                -- Reconstruit 'lng,lat' pour le champ coordonneesXY du formulaire
                IF(s.longitude IS NOT NULL AND s.latitude IS NOT NULL,
                   CONCAT(s.longitude, ',', s.latitude),
                   NULL)                        AS coordonneesXY,
                -- Compte toutes les bornes de la station (pas seulement le PDC courant)
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
            GROUP BY p.id_pdc   -- nécessaire à cause du GROUP_CONCAT sur type_prise
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        return $stmt->fetch();   // false si aucune ligne → le contrôleur renvoie 404
    }

    // ----------------------------------------------------------
    //  CRÉATION — Insère un ensemble station/bornes en transaction
    //
    //  Ordre d'insertion obligatoire (contraintes FK) :
    //    1. amenageur   (référencé par station)
    //    2. operateur   (référencé par station)
    //    3. station     (référence amenageur + operateur)
    //    4. pdc × N     (référence station ; N = $data['nbre_pdc'])
    //    5. type_prise  (table de liaison, seulement sur le 1er PDC)
    //
    //  Si une étape échoue, rollBack() annule tout → pas de données
    //  orphelines dans la base.
    //
    //  Retourne l'id_pdc du premier PDC créé (utilisé pour la
    //  redirection vers la page détail).
    // ----------------------------------------------------------
    public function create(array $data): int {
        return $this->runInTransaction(function () use ($data) {
            // --- 1. Aménageur ---
            // siren peut être vide (champ optionnel) → on stocke NULL plutôt que ''
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

            // --- 2. Opérateur ---
            $stmt = $this->db->prepare(
                "INSERT INTO operateur (nom_operateur, contact_operateur, tel_operateur)
                 VALUES (:nom, :contact, :tel)"
            );
            $stmt->execute([
                ':nom'     => $data['nom_operateur'],
                ':contact' => $data['contact_operateur'] ?? null,
                ':tel'     => $data['tel_operateur']     ?? null,
            ]);
            $id_operateur = (int) $this->db->lastInsertId();

            // --- 3. Station ---
            // id_station_locale est une chaîne métier unique ('STA-<uniqid>')
            // car la base accepte aussi des identifiants externes (import CSV).
            $id_station_locale = 'STA-' . uniqid();
            // parseCoords décompose la chaîne 'lng,lat' en deux flottants
            [$lng, $lat] = $this->parseCoords($data['coordonneesXY'] ?? '');
            $stmt = $this->db->prepare(
                "INSERT INTO station
                     (id_station_locale, id_station_itinerance, nom_station,
                      adresse_station, code_insee, longitude, latitude,
                      id_amenageur, id_operateur)
                 VALUES (:id_sl, :id_iti, :nom, :adresse, :code_insee, :lng, :lat, :id_a, :id_o)"
            );
            $stmt->execute([
                ':id_sl'      => $id_station_locale,
                ':id_iti'     => $data['id_station_itinerance'] ?? null,
                ':nom'        => $data['nom_commune'],
                ':adresse'    => !empty($data['adresse_station']) ? $data['adresse_station'] : $data['nom_commune'],
                ':code_insee' => $data['code_insee'] ?? null,
                ':lng'        => $lng,
                ':lat'        => $lat,
                ':id_a'       => $id_amenageur,
                ':id_o'       => $id_operateur,
            ]);

            // --- 4. PDC (Point De Charge) — une ligne par borne ---
            // max(1, …) : on garantit au moins 1 PDC même si le champ est absent
            $nbre = max(1, (int) ($data['nbre_pdc'] ?? 1));
            $id_condition = $this->getOrCreateCondition($data['acces_recharge'] ?? '');

            $stmt = $this->db->prepare(
                "INSERT INTO pdc (puissance_nominale, date_mise_service, id_station_locale, id_condition)
                 VALUES (:puissance, :date, :id_sl, :id_cond)"
            );
            $firstPdcId = null;
            for ($i = 0; $i < $nbre; $i++) {
                $stmt->execute([
                    ':puissance' => !empty($data['puissance_nominale']) ? (float) $data['puissance_nominale'] : null,
                    ':date'      => !empty($data['date_mise_en_service']) ? $data['date_mise_en_service'] : null,
                    ':id_sl'     => $id_station_locale,
                    ':id_cond'   => $id_condition,
                ]);
                // On mémorise seulement le premier id pour le retourner
                if ($firstPdcId === null) {
                    $firstPdcId = (int) $this->db->lastInsertId();
                }
            }

            // --- 5. Type de prise — lié au premier PDC uniquement ---
            // Le formulaire ne saisit qu'un type global ; les autres PDC
            // partagent la même station donc même type en pratique.
            $this->linkTypePrise($firstPdcId, $data['type_prise'] ?? '');

            return $firstPdcId;   // utilisé par le contrôleur pour la redirection
        });
    }

    // ----------------------------------------------------------
    //  MODIFICATION — Met à jour amenageur, operateur, station
    //  et tous les PDC de la station, à partir d'un id_pdc
    //
    //  On part du PDC ciblé pour remonter à la station, puis à
    //  l'aménageur et l'opérateur (d'où le SELECT initial).
    //  Tous les PDC de la station reçoivent la même puissance
    //  et date (comportement intentionnel : on édite la station
    //  entière, pas une seule borne).
    //
    //  Retourne false si l'id_pdc est introuvable (le contrôleur
    //  renverra un message d'erreur au lieu de crasher).
    // ----------------------------------------------------------
    public function update(int $id, array $data): bool {
        return $this->runInTransaction(function () use ($id, $data) {
            // Résoudre les FK à partir du PDC pour savoir quels enregistrements modifier
            $stmt = $this->db->prepare(
                "SELECT s.id_station_locale, s.id_amenageur, s.id_operateur
                 FROM pdc p
                 JOIN station s ON p.id_station_locale = s.id_station_locale
                 WHERE p.id_pdc = :id"
            );
            $stmt->execute([':id' => $id]);
            $row = $stmt->fetch();
            if (!$row) return false;   // L'id n'existe pas

            // --- Mise à jour de l'aménageur ---
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

            // --- Mise à jour de l'opérateur ---
            $stmt = $this->db->prepare(
                "UPDATE operateur SET nom_operateur = :nom WHERE id_operateur = :id"
            );
            $stmt->execute([
                ':nom' => $data['nom_operateur'],
                ':id'  => $row['id_operateur'],
            ]);

            // --- Mise à jour de la station (nom + code INSEE) ---
            $stmt = $this->db->prepare(
                "UPDATE station SET nom_station = :nom, code_insee = :code
                 WHERE id_station_locale = :id"
            );
            $stmt->execute([
                ':nom'  => $data['nom_commune'],
                ':code' => $data['code_insee'] ?? null,
                ':id'   => $row['id_station_locale'],
            ]);

            // --- Mise à jour de TOUS les PDC de la station ---
            // On cible id_station_locale et non id_pdc pour propager
            // le changement à toutes les bornes du site.
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

            // --- Remplacement du type de prise sur le PDC ciblé ---
            // On supprime l'ancienne liaison puis on recrée (upsert manuel)
            // car MySQL 5.x ne supporte pas facilement ON CONFLICT DO UPDATE.
            $this->db->prepare("DELETE FROM pdc_type_prise WHERE id_pdc = :id")
                     ->execute([':id' => $id]);
            $this->linkTypePrise($id, $data['type_prise'] ?? '');

            return true;
        });
    }

    // ----------------------------------------------------------
    //  SUPPRESSION — Supprime station, PDC et éventuellement
    //  l'aménageur devenu orphelin
    //
    //  Ordre de suppression (contraintes FK) :
    //    1. station   → déclenche la CASCADE sur pdc et pdc_type_prise
    //       (si FOREIGN KEY … ON DELETE CASCADE est déclarée en base)
    //    2. amenageur → seulement si plus aucune station ne le référence
    //       (évite de supprimer un aménageur partagé par d'autres sites)
    //
    //  L'opérateur n'est PAS supprimé : il peut gérer d'autres stations.
    // ----------------------------------------------------------
    public function delete(int $id): bool {
        return $this->runInTransaction(function () use ($id) {
            // Remonter du PDC ciblé vers sa station et son aménageur
            $stmt = $this->db->prepare(
                "SELECT s.id_station_locale, s.id_amenageur
                 FROM pdc p
                 JOIN station s ON p.id_station_locale = s.id_station_locale
                 WHERE p.id_pdc = :id"
            );
            $stmt->execute([':id' => $id]);
            $row = $stmt->fetch();
            if (!$row) return false;   // PDC inexistant → rien à supprimer

            $id_amenageur = $row['id_amenageur'];

            // Supprimer la station : si les FK CASCADE sont actives en base,
            // cela supprime automatiquement tous les PDC et leurs liaisons type_prise.
            $this->db->prepare("DELETE FROM station WHERE id_station_locale = :id_sl")
                     ->execute([':id_sl' => $row['id_station_locale']]);

            // Nettoyage de l'aménageur orphelin (s'il existe et n'est plus utilisé)
            if ($id_amenageur !== null) {
                $cnt = $this->db->prepare(
                    "SELECT COUNT(*) FROM station WHERE id_amenageur = :id_a"
                );
                $cnt->execute([':id_a' => $id_amenageur]);
                // On ne supprime que s'il n'y a plus aucune station rattachée
                if ((int) $cnt->fetchColumn() === 0) {
                    $this->db->prepare("DELETE FROM amenageur WHERE id_amenageur = :id_a")
                             ->execute([':id_a' => $id_amenageur]);
                }
            }

            return true;
        });
    }

    // ----------------------------------------------------------
    //  RECHERCHE — Par nom d'aménageur (recherche partielle LIKE)
    //
    //  Le '%' est ajouté ici (côté modèle) et non dans le formulaire,
    //  pour éviter qu'un utilisateur injecte son propre wildcard.
    //  Limite à 50 résultats pour protéger les performances.
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
            WHERE a.nom_amenageur LIKE :nom   -- recherche insensible à la casse (collation utf8_general_ci)
            GROUP BY s.id_station_locale, a.nom_amenageur, a.siren_amenageur,
                     a.contact_amenageur, o.nom_operateur, s.nom_station
            LIMIT 50
        ";
        $stmt = $this->db->prepare($sql);
        // Le '%' entourant :nom rend la recherche de type 'contient'
        $stmt->execute([':nom' => '%' . $nom . '%']);
        return $stmt->fetchAll();
    }

    // ----------------------------------------------------------
    //  Helpers privés
    // ----------------------------------------------------------

    /** Exécute $fn dans une transaction ; commit si succès, rollBack si exception. */
    private function runInTransaction(callable $fn): mixed {
        $this->db->beginTransaction();
        try {
            $result = $fn();
            $this->db->commit();
            return $result;
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Associe un libellé de type de prise à un PDC (table N:N).
     *
     * Comportement :
     *   - Si le libellé n'existe pas dans type_prise → on le crée.
     *   - INSERT IGNORE évite une erreur si la liaison existe déjà
     *     (clé primaire composite id_pdc + id_type_prise).
     *
     * @param int    $id_pdc   Identifiant de la borne cible
     * @param string $libelle  Ex : 'Type 2', 'CCS', 'CHAdeMO'
     */
    private function linkTypePrise(int $id_pdc, string $libelle): void {
        if (empty($libelle)) return;   // rien à lier si le champ est vide

        // Recherche de l'id existant pour ce libellé
        $stmt = $this->db->prepare(
            "SELECT id_type_prise FROM type_prise WHERE libelle_type_prise = :lib"
        );
        $stmt->execute([':lib' => $libelle]);
        $id_tp = $stmt->fetchColumn();   // false si non trouvé

        if (!$id_tp) {
            // Le type est inconnu : on l'ajoute à la table de référence
            $ins = $this->db->prepare(
                "INSERT INTO type_prise (libelle_type_prise) VALUES (:lib)"
            );
            $ins->execute([':lib' => $libelle]);
            $id_tp = (int) $this->db->lastInsertId();
        }

        // Création de la liaison PDC ↔ type_prise (INSERT IGNORE si déjà présente)
        $this->db->prepare(
            "INSERT IGNORE INTO pdc_type_prise (id_pdc, id_type_prise) VALUES (:id_pdc, :id_tp)"
        )->execute([':id_pdc' => $id_pdc, ':id_tp' => $id_tp]);
    }

    /**
     * Retourne l'id de la condition d'accès correspondant au libellé,
     * ou la crée si elle n'existe pas encore. Retourne null si vide.
     */
    private function getOrCreateCondition(string $condition): ?int {
        if (empty($condition)) return null;

        $stmt = $this->db->prepare(
            "SELECT id_condition FROM condition_d_acces WHERE condition_acces = :cond"
        );
        $stmt->execute([':cond' => $condition]);
        $id = $stmt->fetchColumn();

        if (!$id) {
            $ins = $this->db->prepare(
                "INSERT INTO condition_d_acces (condition_acces) VALUES (:cond)"
            );
            $ins->execute([':cond' => $condition]);
            $id = (int) $this->db->lastInsertId();
        }

        return (int) $id;
    }

    /**
     * Décompose une chaîne 'longitude,latitude' en tableau [float, float].
     *
     * Retourne [null, null] si la chaîne est vide ou mal formée,
     * afin de stocker NULL en base plutôt qu'une coordonnée incorrecte.
     *
     * @param  string $coords  Ex : '2.3522,48.8566'
     * @return array           [$longitude, $latitude] ou [null, null]
     */
    private function parseCoords(string $coords): array {
        if (empty($coords)) return [null, null];
        $parts = explode(',', $coords, 2);   // limite à 2 parties pour ignorer les virgules parasites
        if (count($parts) === 2) {
            return [(float) trim($parts[0]), (float) trim($parts[1])];
        }
        return [null, null];   // format inattendu → coordonnées nulles
    }
}
