<div align="center">

# 🎮 APACH • Game Control Bot

### Pilotez vos serveurs distants directement depuis Discord

Un bot Discord minimaliste, sécurisé et **100 % privé** pour démarrer, arrêter, redémarrer
et surveiller votre serveur de jeu — sans jamais quitter votre salon.

[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A5%2018-3C873A?logo=node.js&logoColor=white)](https://nodejs.org)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)](https://discord.js.org)
[![Licence](https://img.shields.io/badge/licence-MIT-blue)](#-licence)
[![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen)](#-contribuer)

</div>

---

## 📖 Sommaire

| 🧩 Section | 🔗 Lien |
|---|---|
| ✨ Présentation | [Fonctionnalités](#-fonctionnalités) |
| 🖼️ Aperçu | [Rendu dans Discord](#️-aperçu) |
| 🧰 Prérequis | [Ce qu'il vous faut](#-prérequis) |
| 🚀 Installation | [Mise en route](#-installation) |
| ⚙️ Configuration | [Variables d'environnement](#️-configuration) |
| 🎮 Commandes | [Toutes les commandes](#-commandes) |
| 🔐 Permissions | [Rôles et accès](#-permissions) |
| 🔄 Power actions | [Cycle de vie d'une action](#-cycle-de-vie-dune-power-action) |
| 🗂️ Structure | [Organisation du projet](#️-structure-du-projet) |
| 🧯 Dépannage | [Problèmes courants](#-dépannage) |
| 🛡️ Sécurité | [Bonnes pratiques](#️-sécurité) |

---

## ✨ Fonctionnalités

<div align="center">

| 🎯 | Fonctionnalité | Description |
|:---:|---|---|
| 🟢 | **Dashboard live** | État, CPU, RAM, disque, joueurs, uptime, adresse — en un seul embed |
| 🧩 | **Providers pluggables** | 8 adaptateurs — YorkHost, Nitrado, Hetzner, OVHcloud, Scaleway, DigitalOcean, Vultr, UpCloud |
| ▶️ | **Démarrage** | Lance le serveur avec vérification de l'état cible |
| ⏹️ | **Arrêt** | Coupe le serveur proprement, avec garde-fou |
| 🔁 | **Redémarrage** | Redémarre en détectant la remise à zéro de l'uptime |
| 🛡️ | **Double confirmation** | Toute action destructrice exige un clic de validation |
| 🔒 | **Accès granulaire** | Owner + liste d'opérateurs persistée sur disque |
| 👻 | **100 % éphémère** | Aucune réponse publique, aucun ping |
| 🔁 | **Anti-collision** | Un seul power action à la fois **par service** (verrou persistant) |
| ⏳ | **Suivi intelligent** | Polling silencieux à backoff progressif (5 s → 30 s), jusqu'à 10 min, sans double requête |
| ⚡ | **Zéro spam** | Les commandes ne sont réenregistrées que si elles changent |
| 🔔 | **Watchdog** | Alertes Discord automatiques en cas de crash ou surcharge (CPU/RAM/disque) |
| 🏓 | **Ping** | Mesure la latence aller-retour vers l'API du provider configuré |
| ⚡ | **Cache 5 s** | Les GET redondants sont mutualisés (watchdog + /status) |

</div>

---

## 🖼️ Aperçu

> Voici ce que vous voyez avec `/status` :

```text
╭──────────────────────────────────────────────────╮
│  🎮 Mon Super Serveur                            │
│                                                  │
│  🟢 RUNNING                                      │
│                                                  │
│  ⚡ CPU      : 42%         👥 Players : 12       │
│  ⏱ Uptime  : 3h 24m                              │
│                                                  │
│  🧠 Memory  : 2 048 / 4 096 MB                   │
│               ▰▰▰▰▰▱▱▱▱▱ 50.0%                   │
│                                                  │
│  💾 Storage : 8 192 / 20 480 MB                  │
│               ▰▰▰▰▱▱▱▱▱▱ 40.0%                   │
│                                                  │
│  🌐 Address : play.monserveur.fr:25565           │
│  🖥 Node    : node-01                            │
│                                                  │
│  APACH • GAME CONTROL                            │
╰──────────────────────────────────────────────────╯
```

> Et la confirmation avant une action critique :

```text
╭──────────────────────────────────────────────────╮
│  Confirm restart                                  │
│                                                   │
│  ⚠ This interrupts the game session.              │
│  Send restart to service **main**?                │
│                                                   │
│         [ Confirm ]   [ Cancel ]                  │
╰──────────────────────────────────────────────────╯
```

---

## 🧰 Prérequis

<div align="center">

| Élément | Requis | Détail |
|---|:---:|---|
| 🟢 **Node.js** | ✅ | version **18 ou supérieure** |
| 📦 **npm** | ✅ | fourni avec Node.js |
| 🤖 **Application Discord** | ✅ | bot créé sur le [Portail Développeur](https://discord.com/developers/applications) |
| 🔑 **Clé API du provider** | ✅ | récupérable sur le panel de votre hébergeur |
| 🆔 **ID de service** | ✅ | identifiant du serveur chez votre hébergeur |
| 🏠 **Serveur Discord** | ✅ | avec les droits de gérer les commandes |

</div>

---

## 🚀 Installation

### 1️⃣ Récupérer le projet

```bash
git clone <url-du-repo> apach-bot
cd apach-bot
```

### 2️⃣ Installer les dépendances

```bash
npm install
```

### 3️⃣ Créer le fichier de configuration

```bash
cp .apach/.env.example .apach/.env
```

Puis éditez **`.apach/.env`** (voir [Configuration](#️-configuration)).

### 4️⃣ Inviter le bot sur votre serveur

Dans le **Portail Développeur Discord** → *OAuth2 → URL Generator* :

- **Scopes** : `bot` + `applications.commands`
- **Permissions** : `Envoyer des messages`

Générez l'URL, ouvrez-la, sélectionnez votre serveur.

> ℹ️ **Intents** — ce bot n'utilise que l'intent `Guilds`. Aucun intent privilégié
> n'est requis : `/users add|remove` s'appuient sur un `fetch` REST ciblé
> (`/guilds/{id}/members/{user}`), indépendant du gateway.
> Laissez `SERVER MEMBERS INTENT` et `MESSAGE CONTENT INTENT` **désactivés**.

### 5️⃣ Lancer le bot

```bash
node apach-bot.js
```

> 💡 Si un script `start` existe dans `package.json`, `npm start` fonctionnera aussi.

> 🐳 **CI / Docker / systemd (aucun TTY)** : ajoutez `--non-interactive` pour interdire tout prompt.
> Le bot échouera immédiatement si une variable manque, au lieu d'attendre une saisie impossible.
> ```bash
> node apach-bot.js --non-interactive
> ```

Démarrage réussi :

```text
Slash commands registered.
╭────────────────────────────────╮
│ 🎮  APACH • GAME CONTROL       │
│ 👤  APACH#1234               │
│ 🎯  services: main             │
│ 🌐  language: en               │
│ 💻  node v20.x.x  •  pid 12345 │
│ 📅  2024-01-15 10:22:31        │
╰────────────────────────────────╯
```

---

## 🚀 Lancement en production

Deux méthodes au choix. **Ne les lancez pas simultanément** — une seule connexion gateway Discord est autorisée par bot.

### 🅰️ systemd (Linux, production)

Service natif Linux, auto-restart, isolation complète.

```bash
sudo cp deploy/apach-bot.service /etc/systemd/system/
sudo mkdir -p /opt/apach-bot/logs
sudo chown apachbot:apachbot /opt/apach-bot/logs /opt/apach-bot/.apach
sudo systemctl daemon-reload
sudo systemctl enable --now apach-bot
```

> ⚠️ Les répertoires `logs/` et `.apach/` doivent exister et appartenir à `apachbot`
> **avant** le premier démarrage : `ReadWritePaths` les référence et systemd
> évalue ces chemins au chargement de l'unité.

- 📜 Logs : `journalctl -u apach-bot -f` + `logs/apach-bot.log`
- 🔧 Piloter : `systemctl start|stop|restart|status apach-bot`

### 🅱️ PM2 (Linux / macOS / Windows)

Gestionnaire de processus multi-plateforme, interface de suivi graphique.

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # une seule fois, pour le démarrage auto au boot
```

- 📜 Logs : `pm2 logs apach-bot` + `logs/apach-bot.log`
- 🔧 Piloter : `pm2 start|stop|restart|reload apach-bot` (ou `npm run pm2:*`)
- 📊 Surveiller : `pm2 monit` ou `pm2 status`

### 🆚 Comparatif

| Critère | systemd | PM2 |
|---|:---:|:---:|
| Plateforme | Linux uniquement | Linux / macOS / Windows |
| Installation | intégrée | `npm install -g pm2` |
| Auto-restart | ✓ | ✓ |
| Démarrage auto au boot | ✓ natif | `pm2 startup` |
| Logs canoniques | `logs/apach-bot.log` | `logs/apach-bot.log` |
| Interface de suivi | `journalctl` | `pm2 monit` / `pm2 status` |
| Mode cluster | non | oui — ⚠️ non recommandé (1 gateway Discord) |

---

## ⚙️ Configuration

Le bot lit la configuration depuis **`.apach/.env`** en priorité, puis depuis les **variables d'environnement système** (`process.env`) si une valeur est absente. Cela permet un déploiement via `systemd` (`EnvironmentFile=`) ou `Docker` (`-e KEY=VALUE`) sans fichier `.env`.

```ini
# ── 🤖 Discord ────────────────────────────────
DISCORD_TOKEN=VOTRE_TOKEN_DE_BOT
DISCORD_CLIENT_ID=VOTRE_APPLICATION_ID
DISCORD_OWNER_ID=VOTRE_ID_DISCORD
DISCORD_GUILD_ID=ID_DU_SERVEUR_DISCORD

# ── 🎛️ Provider ───────────────────────────────
# PROVIDER=yorkhost
# PROVIDER_API_URL=
PROVIDER_API_KEY=VOTRE_CLE_API_PROVIDER
PROVIDER_SERVICE_ID=ID_DU_SERVEUR
```

> 🎮 **Serveur unique (par défaut)** : définissez uniquement `PROVIDER_SERVICE_ID`.
> 🎮🎮 **Plusieurs serveurs** : définissez `PROVIDER_SERVICES=alias1=id1,alias2=id2` à la place.
> Chaque alias apparaît alors comme choix dans les commandes `/status`, `/start`, `/stop`, `/restart`.
>
> ⚠️ **Limite Discord** : seuls les **25 premiers** services sont exposés comme choix.
> Au-delà, un avertissement est loggé au démarrage et les services surnuméraires
> ne peuvent plus être ciblés (ni via l'option `service`, ni via `/server`).

<div align="center">

| 🔑 Variable | 📍 Où la trouver | 💬 Notes |
|---|---|---|
| `DISCORD_TOKEN` | Portail → *Bot → Token* | 🔒 Secret absolu |
| `DISCORD_CLIENT_ID` | Portail → *General Information → Application ID* | Public |
| `DISCORD_OWNER_ID` | Discord → clic droit sur votre profil → *Copier l'ID* | 👑 Vous |
| `DISCORD_GUILD_ID` | Discord → clic droit sur le serveur → *Copier l'ID* | 🏠 Serveur |
| `PROVIDER` | Composé manuellement | 🧩 Type de serveur : `yorkhost`, `hetzner`, `nitrado`, `ovh`, `scaleway`, `digitalocean`, `vultr`, `upcloud` (défaut `yorkhost`) |
| `PROVIDER_API_URL` | Composé manuellement | 🌐 Surcharge l'URL de base du provider |
| `PROVIDER_API_KEY` | Panel de l'hébergeur → *API* | 🔒 Secret absolu |
| `PROVIDER_SERVICE_ID` | Panel de l'hébergeur → votre serveur | 🎯 Cible du bot (mode mono-serveur) |
| `PROVIDER_SERVICES` | Composé manuellement | 🎯 Mode multi-serveur (`alias=id,…`) |
| `DISCORD_ALERT_CHANNEL_ID` | Discord → clic droit sur le salon → *Copier l'ID* | 🔔 Salon des alertes (optionnel) |
| `ALERT_INTERVAL_MS` | Composé manuellement | ⏱ Intervalle du watchdog en ms (défaut 60000) |
| `BOT_LANGUAGE` | Composé manuellement | 🌐 Langue du bot (`en` ou `fr`, défaut `en`) |

</div>

> 🚫 Le bot **refuse de démarrer** si une variable est vide ou contient encore `YOUR_…`.

### 🌐 Langues

Le bot supporte **l'anglais** (`en`, défaut) et **le français** (`fr`).

- **Sélection** : `BOT_LANGUAGE=fr` dans `.apach/.env`, ou `--lang=fr` au lancement (prioritaire).
- **Portée** : embeds Discord, logs applicatifs, prompts du CLI `setup.js` et messages d'erreur de configuration.
- **Non traduit** : les noms et descriptions des slash commands (`/start`, `/status`, …) restent en anglais — standard Discord, et cela évite un ré-enregistrement des commandes à chaque changement de langue.
- **Bascule à chaud** : pendant le prompt initial, choisir `fr` fait basculer immédiatement les questions suivantes en français.

---

## 🎛️ Providers

Le bot pilote des serveurs via un **provider** — c'est-à-dire un adaptateur pour la classe de serveur considérée.
Chaque provider est un module isolé dans `lib/providers/` et expose la même interface au reste du bot.

### Providers supportés

| Provider (`PROVIDER=`) | Kind | Cible typique |
|---|---|---|
| `yorkhost` | game | Serveurs de jeu YorkHost (API v1, Bearer) |
| `hetzner` | vps | Serveurs Hetzner Cloud (API v1, Bearer token) |
| `nitrado` | game | Game servers Nitrado (NitrAPI, token OAuth long-lived) |
| `ovh` | vps | VPS OVHcloud (API `/vps`, clés AK/AS/CK signées) |
| `scaleway` | vps | Instances Scaleway (Instance API v1, secret key) |
| `digitalocean` | vps | Droplets DigitalOcean (API v2, Bearer token) |
| `vultr` | vps | Instances Vultr (API v2, Bearer API key) |
| `upcloud` | vps | Serveurs UpCloud (API 1.3, Basic auth) |

### Identifiants spécifiques par provider

Le secret principal se met toujours dans `PROVIDER_API_KEY` ; certains
providers exigent des variables d'environnement supplémentaires (à poser
manuellement dans `.apach/.env`) :

- **`ovh`** : `OVH_APPLICATION_SECRET` (secret application) et
  `OVH_CONSUMER_KEY` (clé consommateur) — `PROVIDER_API_KEY` = clé application.
- **`scaleway`** : `SCW_ZONE` optionnel (défaut `fr-par-1`) ; la secret key suffit
  pour identifier le projet sur l'Instance API.
- **`upcloud`** : `PROVIDER_API_KEY` au format `utilisateur:motdepasse`
  (sous-compte API UpCloud).
- **`nitrado`** : `PROVIDER_API_KEY` = token OAuth2 long-lived créé côté Nitrado.

> 🔧 **Ajouter un provider** : créez `lib/providers/<nom>.js` en implémentant le contrat décrit dans `lib/providers/base.js`, déclarez-le dans `lib/providers/index.js`, puis démarrez avec `PROVIDER=<nom>` dans `.apach/.env`.

### Ce qu'un provider doit fournir

- URL de base par défaut, authentification.
- Une fonction pour lire l'état brut, une autre pour envoyer une action power.
- Une fonction de normalisation : elle traduit la réponse brute de l'API vers un format **commun** consommé par le reste du bot.

Le vocabulaire d'état commun est : `running` · `stopped` · `starting` · `stopping` · `unknown`.

---

## 🎮 Commandes

### 🟢 Accessibles aux opérateurs

| Commande | Icône | Description |
|---|:---:|---|
| `/status [service]` | 📊 | Dashboard live. Option `service` : serveur ciblé (sinon session, puis service primaire) |
| `/start [service]` | ▶️ | Démarre le serveur |
| `/stop [service]` | ⏹️ | Arrête le serveur |
| `/restart [service]` | 🔁 | Redémarre le serveur |
| `/ping [service]` | 🏓 | Mesure la latence API pour un serveur |
| `/server` | 🎯 | Définit le serveur par défaut pour votre session |

### 👑 Réservées à l'owner

| Commande | Icône | Description |
|---|:---:|---|
| `/users add` | ✅ | Sélectionne un membre et **autorise** son accès |
| `/users remove` | ❌ | Sélectionne un membre et **révoque** son accès |
| `/users list` | 📋 | Liste les opérateurs autorisés |
| `/users clear` | 🧹 | Révoque **tous** les opérateurs (owner conservé) |
| `/logs [filtre]` | 📜 | Affiche les 30 dernières lignes du log. Option `filtre` : affiche uniquement les lignes contenant ce texte |

### ℹ️ Divers

| Commande | Icône | Description |
|---|:---:|---|
| `/help` | ❓ | Rappel des commandes et permissions |

> 💡 **Toutes les réponses sont éphémères** : seul vous les voyez.

---

## 🔐 Permissions

```text
        👑 OWNER
        │   accès total : status, start, stop, restart, users
        │
        ├── 🛠️  OPÉRATEUR
        │   accès limité : status, start, stop, restart
        │
        └── 👤  MEMBRE
            aucun accès (sauf /help)
```

- Le **owner** est défini par `DISCORD_OWNER_ID` — il ne peut pas être révoqué.
- Les **opérateurs** sont stockés dans `.apach/users.json`.
- L'accès est **revérifié après chaque confirmation** → une révocation prend effet immédiatement.
- Les autorisations **ne modifient pas** les rôles Discord ni les permissions en jeu.

---

## 🔄 Cycle de vie d'une power action

```text
  👤 /restart
      │
      ▼
  ┌──────────────────────────┐
  │ 🔒 Verrou actif (service)│──── oui ──▶ ⏳ "Action already in progress"
  └──────────────────────────┘
      │ non
      ▼
  ┌─────────────────┐
  │  🛡️ Confirmation│──── annulé ──▶ ❌ "Cancelled"
  └─────────────────┘
      │ confirmé
      ▼
  ┌──────────────────────┐
  │ 🔑 Droits revérifiés │──── refusé ──▶ 🚫 "Access revoked"
  └──────────────────────┘
      │ autorisé
      ▼
  ┌──────────────────────┐
  │ 📡 GET état initial  │
  └──────────────────────┘
      │
      ▼
  ┌──────────────────────────┐
  │ 🎯 Déjà dans l'état cible│──── oui ──▶ ✅ "Already in target state"
  └──────────────────────────┘
      │ non
      ▼
  ┌──────────────────────┐
  │ ⚡ POST /power       │  (une seule requête, jamais de retry)
  └──────────────────────┘
      │
      ▼
  ┌─────────────────────────────────────────┐
  │ ⏳ Polling silencieux (backoff 5→30 s)  │
  │    pendant 10 min maximum               │
  │    • détecte la transition / uptime     │
  │    • exige 2 mesures stables            │
  └─────────────────────────────────────────┘
      │
      ├── ✅ stable        ──▶ "Action completed"
      ├── ⚠️ timeout       ──▶ "Completion not confirmed"
      └── 📡 5 échecs API  ──▶ "Status checks failed"
```

> 🛡️ **Garantie anti-double action** : le bot n'envoie **jamais** deux requêtes power sur un même service, même en cas d'incertitude. Le verrou est **par service** : `/start main` et `/stop survival` peuvent tourner en parallèle.

---

## 🔔 Alertes automatiques

Le bot surveille en arrière-plan l'état de **chaque service** défini et envoie une alerte dans un salon Discord configuré si une anomalie est détectée.

### Types d'alertes

| 🚨 Alerte | Condition | Couleur |
|---|---|---|
| 🔴 **Service down** | Transition `running → autre` (hors action demandée par un opérateur) | Rouge |
| ⚠️ **High CPU** | CPU > 90 % | Jaune |
| ⚠️ **High memory** | RAM utilisée > 90 % | Jaune |
| ⚠️ **Disk almost full** | Disque utilisé > 90 % | Jaune |

### Anti-spam

- Délai minimum de **15 minutes** entre deux alertes d'un même type pour un même service.
- Si un `/start`, `/stop` ou `/restart` est en cours sur un service, l'alerte « down » est **supprimée** (l'arrêt est volontaire).

### Activation

Renseignez `DISCORD_ALERT_CHANNEL_ID` dans `.apach/.env` avec l'ID d'un salon (le bot doit y avoir l'accès *Envoyer des messages*). Sans cette variable, le watchdog est **désactivé** — aucun scan, aucune alerte.

### Fréquence

Par défaut **toutes les 60 secondes** (configurable via `ALERT_INTERVAL_MS`, en millisecondes). Après démarrage, le premier scan a lieu **15 secondes** après la connexion Discord.

---

## 🗂️ Structure du projet

```text
apach-bot/
│
├── 📄 apach-bot.js           ← point d'entrée (bootstrap)
├── 📄 .gitignore
├── 📄 README.md
├── 📄 LICENSE                ← licence MIT
├── 📄 ecosystem.config.js    ← configuration PM2
│
├── 📁 lib/
│   ├── ⚙️  config.js         ← ROOT, chargement .env, validation
│   ├── 🛠️  setup.js          ← prompt interactif si .env incomplet
│   ├── 📝 logger.js          ← façade console (info/warn/error)
│   ├── 🌐 api.js             ← client axios + get()
│   ├── 💾 state.js           ← users, verrou, écriture atomique
│   ├── 🎨 embeds.js          ← cartes, boutons, dashboard
│   ├── 🛡️  confirm.js        ← boutons Confirmer / Annuler
│   ├── 📋 commands.js        ← définitions des slash commands
│   ├── 🚀 deploy.js          ← enregistrement (hash + rest.put)
│   ├── ⚡ power.js           ← power actions + polling
│   ├── 👥 manage.js          ← /users add|remove|list|clear
│   ├── 📜 logs.js            ← /logs (owner only)
│   ├── 🏓 ping.js            ← /ping (latence API)
│   ├── 🔔 watchdog.js        ← surveillance + alertes automatiques
│   ├── 🌍 i18n.js            ← traductions en/fr (t, setLanguage)
│   ├── 📂 locales/           ← catalogues en.js / fr.js
│   ├── 📍 paths.js           ← chemins canoniques (ROOT, .apach, logs)
│   ├── 🎯 services.js        ← parsing alias=id + pickService
│   ├── 🧩 providers/
│   │   ├── base.js           ← contrat d'interface + validation
│   │   ├── index.js          ← registry des providers
│   │   ├── yorkhost.js       ← YorkHost (game — référence)
│   │   ├── hetzner.js        ← Hetzner Cloud (vps)
│   │   ├── nitrado.js        ← Nitrado game servers (game)
│   │   ├── ovh.js            ← VPS OVHcloud (vps)
│   │   ├── scaleway.js       ← Instances Scaleway (vps)
│   │   ├── digitalocean.js   ← Droplets DigitalOcean (vps)
│   │   ├── vultr.js          ← Instances Vultr (vps)
│   │   └── upcloud.js        ← Serveurs UpCloud (vps)
│   └── 🎛️  interaction.js    ← handler + gestion d'erreurs
│
├── 📁 test/                  ← suite node:test complète (npm test)
│
├── 📁 .apach/
│   ├── 🔒 .env               ← secrets (⚠️ jamais commité)
│   ├── 📋 .env.example
│   ├── 🔐 active.lock        ← verrou runtime (auto)
│   ├── #️⃣  commands.hash     ← empreinte des commandes (auto)
│   ├── 👥 users.json         ← opérateurs autorisés (auto)
│   └── 🎯 sessions.json      ← service par défaut par utilisateur (auto)
│
└── 📁 node_modules/
```

### 🗃️ Fichiers générés automatiquement

| Fichier | Rôle | Quand |
|---|---|---|
| `.apach/users.json` | Liste des opérateurs | au 1ᵉʳ `/users add` |
| `.apach/sessions.json` | Service par défaut par utilisateur | au 1ᵉʳ `/server` |
| `.apach/active.lock` | Verrous anti-collision (un par service) | pendant une action |
| `.apach/commands.hash` | Détection de changement des slash | au démarrage |
| `logs/apach-bot.log` (+ rotations) | Logs applicatifs rotés (5 Mo × 5) | au démarrage |
| `logs/pm2-{out,error}.log` | Capture brute PM2 (si lancé via PM2) | au démarrage PM2 |

Ces fichiers sont **automatiquement ignorés par Git**.

---

## 📋 Journalisation

Les logs sont écrits en double destination.

| Destination | Format | Rotation |
|---|---|---|
| `logs/apach-bot.log` | `ISO` + tag + message | auto — 5 Mo × 5 fichiers |
| Console (TTY) | `HH:MM:SS` + icône colorée + message | — |
| `logs/pm2-*.log` (si PM2) | Capture brute stdout/stderr | via [pm2-logrotate](https://github.com/keymetrics/pm2-logrotate) |

### Format fichier (stable, grep-friendly)

```
2024-01-15T10:25:12.001Z [INFO ] Audit: power action 'stop' requested by user 123456789 on service 'survival'
2024-01-15T10:25:24.512Z [INFO ] Audit: power action 'stop' on 'survival' confirmed by YorkHost in 12s
2024-01-15T10:26:00.118Z [WARN ] Watchdog: alert sent — 🔴 Service **survival** down
2024-01-15T10:30:41.722Z [ERROR] Request failure {"status":401,"context":"power"}
```

### Format console (TTY)

```
10:25:12 • Audit: power action 'stop' requested by user 123456789 on service 'survival'
10:25:24 • Audit: power action 'stop' on 'survival' confirmed by YorkHost in 12s
10:26:00 ▲ Watchdog: alert sent — 🔴 Service **survival** down
10:30:41 ✖ Request failure {"status":401,"context":"power"}
```

### Niveaux

| Icône | Niveau | Couleur | Signification |
|:---:|---|---|---|
| `•` | INFO | gris | Événement normal |
| `▲` | WARN | jaune | Anomalie non bloquante |
| `✖` | ERROR | rouge | Erreur requise d'attention |

### Bannière de démarrage

À chaque lancement, une bannière encadrée résume la configuration active :

```
╭─────────────────────────────────╮
│ 🎮  APACH • GAME CONTROL        │
│ 👤  APACH#1234                │
│ 🎯  services: main, survival    │
│ 🌐  language: en                │
│ 💻  node v20.10.0  •  pid 12345 │
│ 📅  2024-01-15 10:22:31         │
╰─────────────────────────────────╯
```

Elle est également inscrite dans `logs/apach-bot.log` — visible depuis la commande `/logs`.

---

## 🧯 Dépannage

<details>
<summary><b>❌ Le bot démarre puis s'arrête : <code>Configuration incomplete … Missing: …</code></b></summary>

Le message liste **exactement** les variables manquantes (ex. `Missing: DISCORD_TOKEN, PROVIDER_API_KEY`).
👉 Remplissez-les dans **`.apach/.env`**, puis redémarrez.
`BOT_LANGUAGE` est **optionnel** (défaut `en`) : son absence ne bloque jamais le démarrage.
Sous PM2, une erreur de configuration ne redémarre plus en boucle (exit 78) : le process s'arrête net.

</details>

<details>
<summary><b>❌ Au démarrage : <code>Missing Access</code> (50001)</b></summary>

Discord refuse l'enregistrement des slash commands : le bot n'est pas présent sur la guilde
configurée, ou `DISCORD_CLIENT_ID` ne correspond pas au token.
👉 Invitez le bot : `https://discord.com/oauth2/authorize?client_id=<Application ID>&scope=bot+applications.commands&permissions=0`
👉 Vérifiez `DISCORD_CLIENT_ID` (Application ID du portail développeur) et `DISCORD_GUILD_ID` (ID du serveur).

</details>

<details>
<summary><b>❌ Les commandes n'apparaissent pas dans Discord</b></summary>

- Vérifiez que `DISCORD_CLIENT_ID` correspond à l'*Application ID*.
- Vérifiez que `DISCORD_GUILD_ID` correspond au bon serveur.
- Les commandes sont enregistrées **par guilde** : elles apparaissent immédiatement après le démarrage.
- Dans Discord : *Paramètres → Avancés → Mode développeur* activé pour copier les IDs.

</details>

<details>
<summary><b>❌ Les commandes apparaissent en double dans l'autocomplétion Discord</b></summary>

Deux copies coexistent : une **globale** (application) et une **de guilde**. Le bot enregistre
uniquement les commandes de guilde et **purge les commandes globales à chaque démarrage** :
redémarrez le bot, les doublons disparaissent.
👉 Si les doublons persistent après un redémarrage, ils proviennent d'une **autre application Discord**
(un ancien `DISCORD_CLIENT_ID`) : retirez le bot du serveur et réinvitez-le avec la bonne application,
ou supprimez l'ancienne application dans le portail développeur.

</details>

<details>
<summary><b>⚠️ La commande échoue côté bot alors que l'action est passée côté serveur</b></summary>

Le bot vérifie désormais l'**état réel** du serveur après une erreur de transmission : si l'action a été
appliquée (timeout après exécution, erreur 5xx tardive…), il confirme le succès au lieu d'afficher une
erreur. Les messages d'erreur indiquent la vraie cause : 401 (clé API), 403 (scopes), 404 (ID de
service), 429 (rate limit), 5xx, timeout ou problème réseau.
👉 En cas de doute, consultez `/status` : le bot n'envoie **jamais** de seconde requête power après une erreur.

</details>

<details>
<summary><b>❌ <code>/users add</code> → "Invalid selection"</b></summary>

Le membre sélectionné est un bot, l'owner, ou n'est plus présent sur le serveur.
👉 Vérifiez que la cible est un membre humain du serveur, distinct de l'owner.

</details>

<details>
<summary><b>⚠️ "Completion not confirmed"</b></summary>

La requête a été **acceptée** par l'API de l'hébergeur, mais le bot n'a pas pu vérifier l'état final en 10 min.
👉 Consultez `/status` ou le panel de l'hébergeur.
👉 **Aucune seconde requête n'a été envoyée** — pas de risque de double action.

</details>

<details>
<summary><b>⏳ "Action in progress" alors que rien ne tourne</b></summary>

Un verrou persistant est resté bloqué après un crash.
👉 Supprimez manuellement `.apach/active.lock` (chaque entrée expire seule au bout de **11 minutes**).

</details>

<details>
<summary><b>🌐 "Request failed • HTTP 401 / 403"</b></summary>

Mauvaise clé API ou scopes insuffisants côté hébergeur (voir « Identifiants spécifiques par provider »).
👉 Régénérez `PROVIDER_API_KEY` et vérifiez `PROVIDER_SERVICE_ID`.

</details>

<details>
<summary><b>❌ <code>Configuration incomplete and --non-interactive was provided</code></b></summary>

Le flag `--non-interactive` empêche tout prompt (cas PM2/systemd : stdin n'est pas un terminal).
Le message liste les variables manquantes (`Missing: …`).
👉 Remplissez `.apach/.env` manuellement, ou définissez la variable via `EnvironmentFile=` (systemd) /
`-e KEY=VALUE` (Docker).

</details>

<details>
<summary><b>🔔 Le watchdog n'envoie aucune alerte</b></summary>

- Vérifiez que `DISCORD_ALERT_CHANNEL_ID` est bien renseigné dans `.apach/.env`.
- Vérifiez que le bot a la permission **Envoyer des messages** dans ce salon.
- Consultez `logs/apach-bot.log` : une ligne `Watchdog started` doit apparaître au démarrage.
- Une alerte identique est bloquée pendant **15 minutes** après son envoi (anti-spam).

</details>

---

## 🛡️ Sécurité

<div align="center">

| ✅ À faire | ❌ À ne pas faire |
|---|:---:|
| Garder `.apach/.env` hors du dépôt (déjà dans `.gitignore`) | ❌ Commiter le token ou la clé API |
| Utiliser un bot **dédié** à ce serveur | ❌ Réutiliser un bot multi-usage |
| Revoir les opérateurs régulièrement (`/users list`) | ❌ Donner `/users` à un non-owner |
| Vérifier l'historique Git avant publication | ❌ Publier avec des secrets dans l'historique |

</div>

### 🔍 Vérification de l'historique Git

```bash
git log --all -- .apach/.env
git log --all -- .apach/users.json
```

> 🚨 Si l'une de ces commandes renvoie un résultat : **rotatez immédiatement** votre `DISCORD_TOKEN` et votre `PROVIDER_API_KEY`.

---

## 🧪 Notes techniques

<details>
<summary><b>🔧 Points de maintenance connus (cliquer pour déplier)</b></summary>

- `clientReady` est le nom **actuel** de l'événement (anciennement `ready`).
- L'enregistrement des commandes utilise un **`rest.put` groupé** (une seule requête).
- Le polling marque la réussite après **2 états stables consécutifs**.
- Le polling utilise un **backoff progressif** (5 s → 10 s → 15 s → 20 s → 30 s) : détection plus rapide sur les actions courtes, moins de requêtes sur les longues.
- `lib/api.js` délègue au **provider actif** (`lib/providers/`) et maintient un **cache de 5 s** par service. Les appels critiques (avant/après un POST power, `/ping`) passent `{fresh: true}` pour ignorer le cache.
- Chaque provider gère son propre **agent HTTPS keep-alive** et sa propre normalisation vers le format canonique.
- Le watchdog exécute ses vérifications **en parallèle** (`Promise.all`) sur l'ensemble des services.
- Le watchdog lit `active.lock` via `readLockSnapshot()` (lecture pure) : un scan de surveillance ne réécrit jamais le fichier de verrou.
- Les fichiers d'état (`active.lock`, `sessions.json`) sont écrits en **atomique** (`tmp + rename`) : un crash en cours d'écriture ne peut pas laisser un JSON tronqué.
- Changer de guilde force un ré-enregistrement dans la nouvelle, mais **ne purge pas** les commandes de l'ancienne guilde côté Discord (limitation connue).
- Le watchdog n'a pas de baseline persistée : un service qui tombe dans les **15 premières secondes** suivant le démarrage du bot (avant le premier tick) ne déclenche pas d'alerte « down ».

</details>

---

## 🤝 Contribuer

1. 🍴 Forkez le projet
2. 🌿 Créez une branche (`git checkout -b feature/ma-feature`)
3. ✍️ Commitez (`git commit -m "feat: ma feature"`)
4. 🚀 Pushez (`git push origin feature/ma-feature`)
5. 🎉 Ouvrez une Pull Request

### 🧠 Méthode recommandée pour les modifications assistées par IA

Ce projet est régulièrement modifié via [Aider](https://aider.chat). Selon la nature du changement, le mode d'édition à utiliser diffère — un mauvais choix provoque des erreurs `SearchReplaceNoExactMatch` (l'éditeur-LLM régénère un bloc au lieu de le copier, et rate le match sur des fichiers contenant emojis, accents ou commentaires multi-lignes).

| Type de changement | Mode Aider recommandé | Pourquoi |
|---|---|---|
| Refactoring massif (i18n, renommage global, restructuration) | `--edit-format whole` | L'éditeur réécrit le fichier entier : aucun match à faire, donc aucune erreur de match possible |
| Correctif ponctuel (1–3 blocs, fichier court) | `--edit-format diff` (défaut) | Rapide, économe en tokens, suffisant quand les blocs sont courts et uniques |
| Ajout de fichier neuf | `--edit-format diff` | Un bloc `SEARCH` vide + `REPLACE` complet suffit |

**Bonnes pratiques complémentaires :**

- `/drop` les fichiers non concernés par le chantier en cours — ne garder que les 5–10 fichiers réellement modifiés.
- `/clear` l'historique entre deux chantiers distincts pour éviter que l'éditeur ne confonde des versions successives.
- Éviter de charger plus de ~25 000 tokens de contexte actif : au-delà, la qualité de régénération des blocs chute.
- En cas d'échec isolé sur un bloc : `/retry` suffit généralement (l'éditeur retente avec le contexte corrigé).
- Pour les fichiers contenant des emojis, des accents ou des caractères box-drawing (`─ ╭ ╮ │ ╰ ╯`), préférer `--edit-format whole` : ces caractères peuvent être encodés de façons visuellement identiques mais binairement différentes (NFC vs NFD), ce qui fait échouer un match qui « semble » correct à l'œil.

> 💡 **Règle simple** : si le chantier touche plus de 3 fichiers ou plus de 10 blocs, passez en `--edit-format whole`. Sinon, restez en `diff`.

---

## 📜 Licence

[Licence MIT](LICENSE) — utilisation, modification et redistribution libres,
à condition de conserver la notice de copyright et la présente licence.
Le logiciel est fourni « tel quel », sans garantie d'aucune sorte.

---

<div align="center">

### ⭐ Si ce projet vous est utile, n'oubliez pas de laisser une étoile !

**Fait avec ❤️ pour la communauté Apach**

`🎮 Pilotez. Surveillez. Profitez.`

</div>
