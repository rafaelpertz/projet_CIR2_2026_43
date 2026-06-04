-- ============================================================
-- Script SQL - Base de données IRVE (Bornes de recharge VE)
-- Généré depuis MCD_V1.mcd + irve_init.csv
-- Cible : MySQL / phpMyAdmin
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- Table : amenageur
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amenageur (
    id_amenageur    INTEGER        NOT NULL AUTO_INCREMENT,
    nom_amenageur   TEXT,
    siren_amenageur INT,
    contact_amenageur TEXT,
    PRIMARY KEY (id_amenageur)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Table : operateur
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operateur (
    id_operateur        INTEGER        NOT NULL AUTO_INCREMENT,
    nom_operateur       VARCHAR(100),
    contact_operateur   TEXT,
    tel_operateur       VARCHAR(50),
    PRIMARY KEY (id_operateur)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Table : enseigne
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enseigne (
    id_enseigne     INTEGER        NOT NULL AUTO_INCREMENT,
    nom_enseigne    VARCHAR(100),
    PRIMARY KEY (id_enseigne)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Table : type_prise
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS type_prise (
    id_type_prise       INTEGER        NOT NULL AUTO_INCREMENT,
    libelle_type_prise  VARCHAR(50)     NOT NULL,
    PRIMARY KEY (id_type_prise)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Valeurs de référence (issues du CSV)
INSERT INTO type_prise (libelle_type_prise) VALUES
    ('EF'),
    ('Type 2'),
    ('Combo CCS'),
    ('CHAdeMO'),
    ('Autre');

-- ------------------------------------------------------------
-- Table : horaires
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horaires (
    id_horaires     INTEGER       NOT NULL AUTO_INCREMENT,
    horaires        VARCHAR(100)    NOT NULL,
    PRIMARY KEY (id_horaires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Table : condition_d_acces
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS condition_d_acces (
    id_condition        INTEGER        NOT NULL AUTO_INCREMENT,
    condition_acces     VARCHAR(100)    NOT NULL,
    PRIMARY KEY (id_condition)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Table : station
-- Reçoit les FK de amenageur (Finance), operateur (Exploite),
-- enseigne (Possede) — cardinalités (0,n)-(1,1)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS station (
    id_station_locale       VARCHAR(100)    NOT NULL,
    id_station_itinerance   VARCHAR(100),
    nom_station             VARCHAR(100),
    implantation_station    VARCHAR(100),
    adresse_station         VARCHAR(200),
    code_insee              VARCHAR(10),
    code_dep                VARCHAR(5),
    longitude               FLOAT,
    latitude                FLOAT,
    raccordement            VARCHAR(50),
    id_amenageur            INTEGER,
    id_operateur            INTEGER,
    id_enseigne             INTEGER,
    PRIMARY KEY (id_station_locale),
    CONSTRAINT fk_station_amenageur FOREIGN KEY (id_amenageur)
        REFERENCES amenageur(id_amenageur) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_station_operateur FOREIGN KEY (id_operateur)
        REFERENCES operateur(id_operateur) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_station_enseigne  FOREIGN KEY (id_enseigne)
        REFERENCES enseigne(id_enseigne) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Table : pdc  (Point De Charge)
-- Reçoit la FK de station (contient), horaires, condition_d_acces
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pdc (
    id_pdc              INT             NOT NULL AUTO_INCREMENT,
    puissance_nominale  FLOAT,
    date_mise_service   DATE,
    cable_t2_attache    BOOLEAN,
    gratuit             BOOLEAN,
    paiment_acte        BOOLEAN,
    paiment_cb          BOOLEAN,
    tarification        VARCHAR(500),
    id_station_locale   VARCHAR(100)    NOT NULL,
    id_horaires         INTEGER,
    id_condition        INTEGER,
    PRIMARY KEY (id_pdc),
    CONSTRAINT fk_pdc_station    FOREIGN KEY (id_station_locale)
        REFERENCES station(id_station_locale) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pdc_horaires   FOREIGN KEY (id_horaires)
        REFERENCES horaires(id_horaires) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_pdc_condition  FOREIGN KEY (id_condition)
        REFERENCES condition_d_acces(id_condition) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Table de jonction : pdc_type_prise
-- Relation N,N entre PDC et type_prise (est_equipe_de)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pdc_type_prise (
    id_pdc          INT         NOT NULL,
    id_type_prise   INTEGER    NOT NULL,
    PRIMARY KEY (id_pdc, id_type_prise),
    CONSTRAINT fk_pdctp_pdc        FOREIGN KEY (id_pdc)
        REFERENCES pdc(id_pdc) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pdctp_type_prise FOREIGN KEY (id_type_prise)
        REFERENCES type_prise(id_type_prise) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;