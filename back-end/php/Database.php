<?php
// ============================================================
//  Database.php — Connexion PDO (singleton)
//  Une seule instance de PDO est créée pour toute la page.
// ============================================================

require_once __DIR__ . '/config.php';

class Database {

    private static ?PDO $instance = null;

    // Retourne la connexion PDO (la crée si elle n'existe pas encore)
    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $dsn = 'mysql:host=' . DB_HOST
                 . ';dbname='   . DB_NAME
                 . ';charset='  . DB_CHARSET;

            self::$instance = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION, // Lance une exception en cas d'erreur SQL
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,       // Résultats sous forme de tableau associatif
                PDO::ATTR_EMULATE_PREPARES   => false,                  // Vraies requêtes préparées côté serveur
            ]);
        }
        return self::$instance;
    }
}
