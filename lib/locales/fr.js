"use strict";

// Traduction française. Doit rester en parité stricte avec en.js.
module.exports = {
  common: {
    accessDeniedMember: {
      title: "Accès refusé",
      body: "Demandez au propriétaire du bot de vous accorder l'accès opérateur.",
    },
    accessDeniedGuild: {
      title: "Accès refusé",
      body: "Ce bot est configuré pour un autre serveur Discord.",
    },
    unknownService: {
      title: "Service inconnu",
      body: "Aucun service nommé `{alias}`.",
    },
    sessionReset: {
      title: "🎯 Session réinitialisée",
      body: "Votre service de session `{alias}` n'existe plus. Session effacée — les commandes cibleront désormais le service par défaut.",
    },
    unhandledCommand: {
      title: "⚠ Erreur",
      body: "Commande non gérée.",
    },
    defaultService: {
      title: "🎯 Service par défaut",
      body: "Votre session cible désormais **{alias}**.",
    },
    genericError: {
      title: "⚠ Erreur",
    },
  },

  confirm: {
    confirm: "Confirmer",
    cancel: "Annuler",
    cancelled: {
      title: "Annulé",
      body: "Aucune modification effectuée.",
    },
    processing: {
      title: "Traitement",
      body: "Veuillez patienter…",
    },
    expired: {
      title: "Expiré",
      body: "Confirmation expirée. Relancez la commande.",
    },
  },

  help: {
    title: "🎮 Contrôle du serveur",
    body: "**Serveur**\n/status — tableau de bord en direct\n/start — démarrer\n/stop — arrêter\n/restart — redémarrer\n/ping — mesurer la latence de l'API\n/server — définir votre service par défaut pour cette session\nToutes acceptent une option `service` optionnelle pour choisir un serveur cible.\n\n**Propriétaire uniquement**\n/users add — sélectionner et autoriser\n/users remove — sélectionner et révoquer\n/users list — voir les opérateurs\n/users clear — réinitialiser les accès\n/logs — voir les dernières lignes de log\n\nLes commandes power exigent une confirmation. Toutes les réponses sont privées. Les autorisations ne concernent que ce bot.",
  },

  power: {
    accessDenied: {
      title: "Accès refusé",
      body: "Demandez au propriétaire du bot de vous accorder l'accès opérateur.",
    },
    actionInProgress: {
      title: "Action en cours",
      body: "Une action **{action}** est déjà en cours de suivi sur **{alias}**.",
    },
    confirm: {
      title: "Confirmer {action}",
      warning: "⚠ Cela interrompt la session de jeu.\n",
      body: "Envoyer **{action}** au service **{alias}** ?",
    },
    accessRevoked: {
      title: "Accès révoqué",
      body: "Votre accès opérateur a été révoqué.",
    },
    busy: {
      title: "Occupé",
      body: "Une autre action a démarré sur **{alias}** pendant votre confirmation.",
    },
    alreadyInTargetState: {
      title: "Déjà dans l'état cible",
      body: "Le serveur est **{state}**. Aucune requête power envoyée.",
    },
    accepted: {
      title: "⏳ Action acceptée",
      body: "**{action}** envoyée. Suivi silencieux (espacement progressif), pendant 10 minutes maximum.\nL'état running de l'API ne garantit pas que le jeu soit joignable.",
    },
    completed: {
      title: "✅ Action terminée",
      body: "**{action}** confirmée par {provider}.\nÉtat actuel : **{state}**\nDurée : {seconds} secondes.",
      tail: "\nLe jeu peut encore nécessiter un peu de temps pour devenir joignable.",
    },
    appliedDespiteError: {
      title: "✅ Action appliquée",
      body: "La requête a renvoyé une erreur, mais l'état vérifié confirme l'objectif : **{state}** ({provider}).\nAucune nouvelle requête power n'a été envoyée.",
    },
    notConfirmed: {
      title: "⚠ Fin non confirmée",
      bodyFailed: "La requête a été acceptée, mais les vérifications d'état ont échoué à plusieurs reprises.\nDernier état connu : **{state}**.\nUtilisez /status ou le panel du jeu. **Aucune seconde requête power n'a été envoyée.**",
      bodyTimeout: "La requête a été acceptée, mais la fin n'a pas pu être vérifiée dans les 10 minutes.\nDernier état connu : **{state}**.\nUtilisez /status ou le panel du jeu. **Aucune seconde requête power n'a été envoyée.**",
    },
  },

  status: {
    title: "🎮 {name}",
    fallbackName: "Serveur de jeu",
    cpu: "⚡ CPU",
    players: "👥 Joueurs",
    uptime: "⏱ Uptime",
    memory: "🧠 Mémoire",
    storage: "💾 Stockage",
    address: "🌐 Adresse",
    node: "🖥 Nœud",
    notReported: "Non rapporté",
  },

  ping: {
    failed: {
      title: "🏓 Ping échoué",
      body: "Service **{alias}** injoignable{statusPart}.\nVérifiez votre clé API et l'ID de service.",
      statusSuffix: " (HTTP {status})",
    },
    pong: {
      title: "🏓 Pong",
      body: "Le service **{alias}** a répondu en **{ms} ms**.",
    },
  },

  manage: {
    accessDenied: {
      title: "Accès refusé",
      body: "Seul le propriétaire configuré peut gérer les opérateurs.",
    },
    list: {
      titleOne: "👥 Opérateurs autorisés",
      titleMany: "👥 Opérateurs autorisés (page {page}/{totalPages})",
      header: "👑 Propriétaire : <@{ownerId}>",
      entry: "🛠 <@{id}> • {id}",
    },
    clear: {
      confirmTitle: "⚠ Révoquer tous les opérateurs ?",
      confirmBody: "Le propriétaire conserve l'accès. Les membres et rôles Discord ne sont pas modifiés.",
      doneTitle: "Accès réinitialisé",
      doneBody: "Toutes les autorisations d'opérateur ont été retirées. L'accès du propriétaire est conservé.",
    },
    select: {
      title: "👥 Sélectionner un membre",
      placeholder: "Rechercher et sélectionner un membre Discord",
      bodyAdd: "Accorder l'accès aux commandes status et power. Confirmez ensuite votre sélection.",
      bodyRemove: "Révoquer l'accès aux commandes status et power. Confirmez ensuite votre sélection.",
    },
    expired: {
      title: "Expiré",
      body: "Sélection expirée. Relancez /users.",
    },
    invalid: {
      title: "Sélection invalide",
      body: "Choisissez un membre humain autre que le propriétaire.",
    },
    noChange: {
      title: "Aucun changement nécessaire",
      bodyAdd: "Ce membre a déjà accès.",
      bodyRemove: "Ce membre n'a aucune autorisation d'opérateur.",
    },
    confirm: {
      title: "Confirmer le changement d'accès",
      body: "**{verb}** <@{target}> ({username}) ?\nCela modifie uniquement l'accès au bot, pas les rôles Discord ni les permissions en jeu.",
      verbAdd: "Autoriser",
      verbRemove: "Révoquer",
    },
    done: {
      title: "✅ Accès mis à jour",
      bodyAdd: "<@{target}> peut désormais utiliser /status, /start, /stop et /restart.",
      bodyRemove: "<@{target}> n'a plus l'accès opérateur.",
    },
  },

  logs: {
    accessDenied: {
      title: "Accès refusé",
      body: "Seul le propriétaire configuré peut consulter les logs.",
    },
    cardTitle: "📜 Logs",
    notFound: "Fichier de log introuvable.",
    readFailed: "Impossible de lire le fichier de log ({code}).",
    titleFiltered: "📜 {count} ligne(s) correspondant à \"{filter}\"",
    titleLast: "📜 {count} dernières lignes de log",
    nothingFiltered: "Aucune ligne ne correspond à \"{filter}\".",
    empty: "Le fichier de log est vide.",
  },

  watchdog: {
    down: {
      title: "🔴 Service **{alias}** hors ligne",
      body: "Changement d'état **running → {state}**.\nAdresse : `{address}`.\nVérifiez le panel {provider}.",
    },
    highCpu: {
      title: "⚠ CPU élevé sur **{alias}**",
      body: "CPU : **{pct}%** (seuil {threshold}%).",
    },
    highRam: {
      title: "⚠ Mémoire élevée sur **{alias}**",
      body: "RAM : **{pct}%** ({used}/{max} MB).",
    },
    highDisk: {
      title: "⚠ Disque presque plein sur **{alias}**",
      body: "Disque : **{pct}%** ({used}/{max} MB).",
    },
  },

  setup: {
    intro: "\n🛠  Première configuration détectée — quelques valeurs sont requises.\n",
    fileLine: "   Fichier : {envFile}\n\n",
    languageLabel: "Language / Langue [en/fr]",
    promptLine: "   {question} : ",
    promptLineHidden: "🔒 {question} : ",
    prompt: {
      discordToken: "Token du bot Discord",
      discordClientId: "ID d'application Discord",
      discordOwnerId: "ID utilisateur du propriétaire Discord",
      discordGuildId: "ID du serveur Discord",
      providerApiKey: "Clé API du provider",
      providerServiceId: "ID de service (mode mono-cible)",
      providerServices: "Services (multi-cibles alias=id, séparés par des virgules)",
    },
    invalid: "   ⚠ Valeur invalide, veuillez réessayer.\n",
    complete: "\n✅ Configuration enregistrée dans {envFile}\n\n",
  },

  errors: {
    missingConfig: "Configuration manquante : {key}",
    missingServiceId: "ID de service manquant pour l'alias \"{alias}\"",
    invalidService: "Configuration manquante : définissez PROVIDER_SERVICE_ID ou PROVIDER_SERVICES",
    requestFailed: "Requête échouée{statusPart}{codePart}.{suffix}",
    requestFailedStatus: " • HTTP {status}",
    requestFailedCode: " • {code}",
    requestFailedPowerSuffix: " Aucun retry automatique des requêtes power.",
    requestFailedAuth: "Authentification refusée{statusPart}{codePart}. La clé API semble invalide ou expirée.{suffix}",
    requestFailedForbidden: "Accès refusé{statusPart}{codePart}. Vérifiez les scopes et permissions de la clé API.{suffix}",
    requestFailedNotFound: "Cible introuvable{statusPart}{codePart}. Vérifiez l'ID de service dans le fichier .env.{suffix}",
    requestFailedRateLimit: "Limite de débit atteinte{statusPart}{codePart}. Le provider refuse temporairement les requêtes — réessayez plus tard.{suffix}",
    requestFailedServer: "Le provider a renvoyé une erreur{statusPart}{codePart}. Rien n'a été envoyé — réessayez ou consultez le panel du provider.{suffix}",
    requestFailedServerSent: "Le provider a renvoyé une erreur après la transmission{statusPart}{codePart}. L'action a pu être appliquée — vérifiez /status. Aucune nouvelle requête n'a été envoyée.{suffix}",
    requestFailedTimeout: "Le provider n'a pas répondu à temps. Rien n'a été envoyé — vérifiez la connectivité et réessayez.{suffix}",
    requestFailedTimeoutSent: "Le provider n'a pas répondu à temps après la transmission. L'action a pu être appliquée — vérifiez /status. Aucune nouvelle requête n'a été envoyée.{suffix}",
    requestFailedNetwork: "Impossible de joindre l'API du provider (erreur réseau). Vérifiez la connectivité et PROVIDER_API_URL.{suffix}",
    requestFailedGeneric: "Requête échouée. {message}{suffix}",
    setupIncompleteNonInteractive: "Configuration incomplète et --non-interactive a été fourni. Manquantes : {missing}. Remplissez {envFile} manuellement ou fournissez les variables via l'environnement.",
    setupIncompleteNoTty: "Configuration incomplète et aucun terminal interactif disponible. Manquantes : {missing}. Remplissez {envFile} manuellement ou fournissez les variables via l'environnement.",
    setupIncompleteCheck: "Configuration incomplète : \"{key}\" est vide et son alternative \"{alt}\" n'est pas définie.",
    invalidUsersJsonParse: "users.json invalide (JSON malformé). Corrigez ou supprimez le fichier, puis redémarrez.",
    invalidUsersJsonShape: "users.json invalide (tableau d'IDs Discord attendu). Corrigez ou supprimez le fichier, puis redémarrez.",
    deployMissingAccess: "Discord a refusé : Missing Access (50001). Le bot n'est pas présent sur la guilde {guild}, ou DISCORD_CLIENT_ID ne correspond pas au token. Invitez le bot : https://discord.com/oauth2/authorize?client_id={client}&scope=bot+applications.commands",
    deployUnknownApplication: "Discord a refusé : application inconnue. DISCORD_CLIENT_ID={client} ne correspond à aucune application pour ce token. Vérifiez l'Application ID dans le portail développeur Discord.",
  },

  audit: {
    powerRequested: "Audit : action power '{action}' demandée par l'utilisateur {userId} sur le service '{alias}'",
    powerSendFailed: "Audit : transmission '{action}' vers '{alias}' en échec : {error}",
    powerAppliedDespiteError: "Audit : action '{action}' sur '{alias}' appliquée malgré l'erreur de transmission (état {state})",
    powerConfirmed: "Audit : action power '{action}' sur '{alias}' confirmée par {provider} en {seconds}s",
    powerNotConfirmed: "Audit : action power '{action}' sur '{alias}' non confirmée dans les 10 minutes (échecs={failures})",
    operatorGranted: "Audit : opérateur {target} autorisé par le propriétaire {ownerId}",
    operatorRevoked: "Audit : opérateur {target} révoqué par le propriétaire {ownerId}",
    operatorsCleared: "Audit : tous les opérateurs effacés par le propriétaire {ownerId}",
    commandsSkipped: "Commandes slash inchangées, enregistrement ignoré.",
    commandsRegistered: "Commandes slash enregistrées.",
    commandsGlobalPurged: "Commandes globales purgées (aucun doublon global/guilde possible).",
    commandsGlobalPurgeFailed: "Purge des commandes globales impossible : {error}",
    commandsOldGuildPurged: "Commandes de l'ancienne guilde {guild} purgées.",
    commandsOldGuildPurgeFailed: "Purge des commandes de l'ancienne guilde {guild} impossible : {error}",
    commandsHashFailed: "Impossible de persister le hash des commandes : {error}",
    watchdogDisabled: "Watchdog désactivé (DISCORD_ALERT_CHANNEL_ID non défini).",
    watchdogStarted: "Watchdog démarré (intervalle {interval}ms, salon {channel}).",
    watchdogAlertSent: "Watchdog : alerte envoyée — {title}",
    watchdogAlertFailed: "Watchdog : impossible d'envoyer l'alerte : {error}",
    watchdogCheckFailed: "Watchdog : vérification échouée pour '{alias}' : {error}",
    lockWriteFailed: "Impossible d'écrire le fichier de verrou : {error}",
    sessionsWriteFailed: "Impossible d'écrire le fichier de sessions : {error}",
    usersParseFailed: "Impossible de parser users.json : {error}",
    usersInvalidEntry: "Entrée invalide ignorée dans users.json : {entry}",
    usersNotArray: "users.json n'est pas un tableau.",
  },
};
