# Guide d'installation — BreizhCharge

Déploiement sur un serveur Linux avec Apache et VirtualHost, via SSH.

## Prérequis serveur

- Apache 2.4+ avec `mod_rewrite` activé
- PHP 8.0+ avec l'extension `pdo_mysql`
- MySQL 5.7+ ou MariaDB 10.4+
- Accès SSH avec les droits `sudo`

---

## 1. Transférer les fichiers

Avec FileZilla, importez votre zip sur le serveur?



Puis se connecter en SSH et décompresser :

```bash
ssh user1@10.10.51.43
cd /var/www/
unzip projet-cir2-43.zip

sudo chown -R www-data:www-data projet-cir2-43/
sudo chmod -R 755 projet-cir2-43/
```

---

## 2. Créer la base de données

```bash
mysql -u root -p
```

Dans le shell MySQL :

```sql
CREATE DATABASE breizhohm;
CREATE USER 'breizhohm'@'localhost' IDENTIFIED BY 'breizhohm';
GRANT ALL PRIVILEGES ON breizhohm.* TO 'breizhohm'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Importer le schéma et les données :

```bash
mysql -u breizhohm -p breizhohm < /var/www/projet-cir2-43/sql/create.sql
mysql -u breizhohm -p breizhohm < /var/www/projet-cir2-43/sql/insert.sql
```

---

## 3. Configurer la connexion BDD

Si vous avez choisi des identifiants différents, éditer `api/config.php` :

```bash
nano /var/www/projet-cir2-43/api/config.php
```

Les valeurs par défaut attendues sont :

```php
define('DB_HOST', 'localhost');
define('DB_USER', 'breizhohm');
define('DB_PASS', 'breizhohm');
define('DB_NAME', 'breizhohm');
```

---

## 4. Configurer le VirtualHost Apache

Créer un fichier de configuration :

```bash
sudo nano /etc/apache2/sites-available/breizhcharge.conf
```

Contenu à adapter avec votre domaine et le chemin réel :

```apache
<VirtualHost *:80>
    ServerName votre-domaine.fr
    DocumentRoot /var/www/projet-cir2-43

    <Directory /var/www/projet-cir2-43>
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/breizhcharge_error.log
    CustomLog ${APACHE_LOG_DIR}/breizhcharge_access.log combined
</VirtualHost>
```

Activer le site et `mod_rewrite`, puis recharger Apache :

```bash
sudo a2ensite breizhcharge.conf
sudo a2enmod rewrite
sudo systemctl reload apache2
```

---

## 5. Vérification

Tester que l'API répond correctement :

```bash
curl https://votre-domaine.fr/api/stats
```

La réponse doit être un JSON avec les statistiques des bornes (total, départements, types de prise...).

Accès aux pages :

| Page | URL |
|---|---|
| Accueil | `https://votre-domaine.fr/` |
| Carte interactive | `https://votre-domaine.fr/carte.html` |
| Recherche | `https://votre-domaine.fr/recherche.html` |
| Back-office | `https://votre-domaine.fr/back/` |

---

## Problèmes fréquents

**Erreur 403 sur l'API** → `AllowOverride All` absent du VirtualHost, ou `mod_rewrite` non activé.

**Erreur 500 / PDOException** → Identifiants BDD incorrects dans `api/config.php`, ou base inexistante. Consulter `/var/log/apache2/breizhcharge_error.log`.

**Erreur 502/404 sur les routes `/api/...`** → Le `.htaccess` dans `api/` n'est pas pris en compte. Vérifier `AllowOverride All`.

**Carte vide** → `sql/insert.sql` n'a pas été exécuté. Vérifier avec `mysql -u breizhohm -p -e "SELECT COUNT(*) FROM breizhohm.station;"`.

**Droits refusés sur les fichiers** → Relancer `sudo chown -R www-data:www-data /var/www/projet-cir2-43/`.
