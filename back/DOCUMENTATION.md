# Documentation Back-End — IRVE Breizh Ohm

## Vue d'ensemble

Le back-end est une application PHP pure : **aucun JavaScript**. Toute la logique
(chargement des données, soumission des formulaires, navigation) est gérée côté
serveur par PHP. Le navigateur n'exécute rien.

---

## Structure des fichiers

```
back/
├── breizh_accueil.php      → Page d'accueil (statique)
├── breizh_liste.php        → Liste des installations
├── breizh_detail.php       → Détail d'une installation + recherche
├── breizh_creation.php     → Formulaire d'ajout
├── breizh_modification.php → Formulaire de modification / suppression
├── breizh_style.css        → Feuille de style commune
│
└── php/
    ├── api.php             → API JSON (conservée pour usage futur/externe)
    ├── IRVEModel.php       → Toutes les requêtes SQL (liste, détail, create, update, delete, search)
    ├── Database.php        → Connexion PDO à la base de données
    └── config.php          → Paramètres de connexion (hôte, base, user, mot de passe)
```

---

## Principe de fonctionnement PHP

### Avant (JavaScript + AJAX)
```
Navigateur charge la page HTML vide
→ JavaScript fait un fetch() vers api.php
→ api.php interroge la base
→ JavaScript reçoit le JSON et construit le HTML
```

### Maintenant (PHP pur)
```
Navigateur demande breizh_liste.php
→ PHP interroge directement la base via IRVEModel
→ PHP génère le HTML complet avec les données dedans
→ Le navigateur affiche la page, déjà prête
```

---

## Pages en détail

### breizh_accueil.php
- Page statique, aucune donnée en base.
- Les boutons du hero (`Ajouter`, `Modifier`) sont des liens `<a href="...">`.

---

### breizh_liste.php
- Charge les 100 premières installations via `$model->getListe()`.
- Génère le tableau HTML avec une boucle `foreach`.
- Les boutons "Voir" et "Éditer" de chaque ligne sont des liens `<a href="breizh_detail.php?id=X">`.

---

### breizh_detail.php

**Paramètres GET acceptés :**
| Paramètre | Exemple       | Effet                                  |
|-----------|---------------|----------------------------------------|
| `id`      | `?id=42`      | Affiche le détail de l'installation 42 |
| `nom`     | `?nom=Rennes` | Recherche les aménageurs contenant "Rennes" |

**Fonctionnement :**
1. PHP lit `$_GET['id']` et appelle `$model->getById($id)` → affiche les tableaux de détail.
2. PHP lit `$_GET['nom']` et appelle `$model->searchByNom($nom)` → affiche un tableau de résultats.
3. Cliquer sur un résultat de recherche redirige vers `breizh_detail.php?id=X`.

---

### breizh_creation.php

**Requête GET :** affiche le formulaire vide.

**Requête POST :** traite les données saisies.
1. PHP récupère les champs via `$_POST`.
2. Valide les champs obligatoires (nom_amenageur, nom_operateur, commune, nbre_pdc, type_prise).
3. **Si erreur :** réaffiche le formulaire avec le message d'erreur et les valeurs déjà saisies.
4. **Si OK :** appelle `$model->create($data)` puis redirige vers `breizh_detail.php?id=<nouvel_id>`.

---

### breizh_modification.php

**Requête GET `?id=X` :** charge les données existantes et pré-remplit le formulaire.

**Requête POST :** déterminée par le champ caché `_action`.

| Valeur de `_action`  | Effet                                                         |
|----------------------|---------------------------------------------------------------|
| `update`             | Met à jour en base → redirige vers `breizh_detail.php?id=X`  |
| `delete`             | Affiche une confirmation (sans supprimer encore)              |
| `delete_confirm`     | Supprime définitivement → redirige vers `breizh_liste.php`    |

> **Note :** La suppression nécessite deux clics (Supprimer → Confirmer) pour éviter
> les accidents, en remplacement de la boîte de dialogue JavaScript `confirm()`.

---

## Sécurité — Protection XSS

Chaque page déclare une fonction `e()` qui échappe les caractères HTML dangereux
avant de les afficher. **Tout** ce qui vient de la base ou de l'utilisateur
passe par `e()`.

```php
function e($valeur): string {
    return htmlspecialchars((string)($valeur ?? ''), ENT_QUOTES, 'UTF-8');
}
```

Exemple dans le HTML :
```php
<td><?= e($row['nom_amenageur']) ?></td>
```

---

## Navigation

La navigation entre pages utilise des liens `<a href="...">` HTML standard.  
La barre de navigation demo (en haut) met en surbrillance la page courante via
la classe CSS `active` écrite **en dur** dans chaque fichier :

```html
<!-- Dans breizh_liste.php, le bouton Liste est actif -->
<a class="demo-btn active" href="breizh_liste.php">📋 Liste</a>
```

---

## Connexion à la base de données

La configuration se trouve dans `php/config.php`.  
La connexion PDO est gérée par `php/Database.php` (singleton).  
Toutes les requêtes SQL sont dans `php/IRVEModel.php`.

Les requêtes utilisent des **requêtes préparées** (`$stmt->execute([':param' => $val])`)
pour se protéger contre les injections SQL.

---

## Lancer le projet

Avec WAMP actif, accéder à :
```
http://localhost/projet_CIR2_2026_43/back/breizh_accueil.php
```
