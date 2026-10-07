"use strict";

// Catalogue de référence. Toute nouvelle clé doit être ajoutée ici ET dans fr.js.
module.exports = {
  common: {
    accessDeniedMember: {
      title: "Access denied",
      body: "Ask the bot owner to grant operator access.",
    },
    accessDeniedGuild: {
      title: "Access denied",
      body: "This bot is configured for a different Discord server.",
    },
    unknownService: {
      title: "Unknown service",
      body: "No service named `{alias}`.",
    },
    sessionReset: {
      title: "🎯 Session reset",
      body: "Your session service `{alias}` no longer exists. Session cleared — commands will now target the default service.",
    },
    unhandledCommand: {
      title: "⚠ Error",
      body: "Unhandled command.",
    },
    defaultService: {
      title: "🎯 Default service",
      body: "Your session now targets **{alias}**.",
    },
    genericError: {
      title: "⚠ Error",
    },
  },

  confirm: {
    confirm: "Confirm",
    cancel: "Cancel",
    cancelled: {
      title: "Cancelled",
      body: "No changes made.",
    },
    processing: {
      title: "Processing",
      body: "Please wait…",
    },
    expired: {
      title: "Expired",
      body: "Confirmation expired. Run the command again.",
    },
  },

  help: {
    title: "🎮 Game control",
    body: "**Server**\n/status — live dashboard\n/start — start\n/stop — stop\n/restart — restart\n/ping — measure API latency\n/server — set your default service for this session\nAll accept an optional `service` option to pick a target server.\n\n**Owner only**\n/users add — mention and authorize\n/users remove — mention and revoke\n/users list — view operators\n/users clear — reset access\n/logs — view the last log lines\n\nPower commands require confirmation. All responses are private. Grants apply only to this bot.",
  },

  power: {
    actions: {
      start: {verb: "Start", cap: "Start", title: "Confirm start"},
      stop: {verb: "Stop", cap: "Stop", title: "Confirm stop"},
      restart: {verb: "Restart", cap: "Restart", title: "Confirm restart"},
    },    accessDenied: {
      title: "Access denied",
      body: "Ask the bot owner to grant operator access.",
    },
    actionInProgress: {
      title: "Action in progress",
      body: "A **{action}** action is already being monitored on **{name}**.",
    },
    confirm: {
      warning: "⚠ This interrupts the game session.\n",
      body: "{verb} the **{name}** service?",
    },
    accessRevoked: {
      title: "Access revoked",
      body: "Your operator access was revoked.",
    },
    busy: {
      title: "Busy",
      body: "Another action started on **{name}** while you were confirming.",
    },
    alreadyInTargetState: {
      title: "Already in target state",
      body: "Server is **{state}**. No power request sent.",
    },
    accepted: {
      title: "⏳ Action accepted",
      body: "Request sent. Monitoring silently (progressively spaced), for up to 10 minutes.\nAPI running state does not guarantee the game is joinable.",
    },
    acceptedAfterError: {
      title: "⏳ Transmission uncertain — tracking",
      body: "**{cap}** was transmitted, but the provider returned an error. Silently tracking the real state (progressively spaced), for up to 10 minutes.\n**No second power request will be sent.**",
    },
    completed: {
      title: "✅ Action completed",
      body: "**{cap}** confirmed by {provider}.\nCurrent state: **{state}**\nElapsed: {seconds} seconds.",
      tail: "\nThe game may still need time to become joinable.",
    },
    appliedDespiteError: {
      title: "✅ Action completed",
      body: "**{cap}** completed on the server.\nVerified state: **{state}** ({provider}).\n\n*Note: the API returned an error during transmission, but the action was applied. No new power request was sent.*",
    },
    eta: "⏱ On average: {seconds}s",
    cancelTracking: "❌ Stop tracking",
    trackingCancelled: {
      title: "Tracking cancelled",
      body: "Tracking stopped. The action may still be running in the background — check /status.",
    },
    notConfirmed: {
      title: "⚠ Completion not confirmed",
      bodyFailed: "Request was accepted, but status checks repeatedly failed.\nLast known state: **{state}**.\nUse /status or the game panel. **No second power request was sent.**",
      bodyTimeout: "Request was accepted, but completion could not be verified within 10 minutes.\nLast known state: **{state}**.\nUse /status or the game panel. **No second power request was sent.**",
      bodyTransmitError: "The transmission returned an error, but the action may have been applied. Completion could not be verified within 10 minutes.\nLast known state: **{state}**.\nUse /status or the game panel. **No second power request was sent.**",
    },
  },

  status: {
    title: "🎮 {name}",
    cpu: "⚡ CPU",
    players: "👥 Players",
    uptime: "⏱ Uptime",
    memory: "🧠 Memory",
    storage: "💾 Storage",
    address: "🌐 Address",
    node: "🖥 Node",
    metrics: "ℹ️ Metrics",
    notReported: "Not reported",
    stateRunning: "🟢 ONLINE",
    stateOffline: "🔴 OFFLINE",
    stateUnknown: "🟡 UNKNOWN",
  },

  ping: {
    failed: {
      title: "🏓 Ping failed",
      body: "Service **{alias}** unreachable{statusPart}.\nCheck your API key and service ID.",
      statusSuffix: " (HTTP {status})",
    },
    pong: {
      title: "🏓 Pong",
      body: "Service **{alias}** responded in **{ms} ms**.",
    },
  },

  manage: {
    accessDenied: {
      title: "Access denied",
      body: "Only the configured owner can manage operators.",
    },
    list: {
      titleOne: "👥 Authorized operators",
      titleMany: "👥 Authorized operators (page {page}/{totalPages})",
      header: "👑 Owner: {owner}",
      entry: "🛠 {name}",
    },
    clear: {
      confirmTitle: "⚠ Revoke all operators?",
      confirmBody: "The owner keeps access. Discord members and roles are not modified.",
      doneTitle: "Access reset",
      doneBody: "All operator grants removed. Owner access preserved.",
    },
    invalid: {
      title: "Invalid selection",
      body: "Choose a human member other than the owner.",
    },
    staleCommand: {
      title: "Outdated command",
      body: "Your Discord app still has the old command cached.\nRestart Discord (fully quit the app, or Ctrl+R on desktop) and retry: /users add must show a \"member\" field.",
    },
    noChange: {
      title: "No change needed",
      bodyAdd: "This member already has access.",
      bodyRemove: "This member has no operator grant.",
    },
    confirm: {
      title: "Confirm access change",
      body: "**{verb}** {username}?\nThis changes bot access only, not Discord roles or in-game permissions.",
      verbAdd: "Authorize",
      verbRemove: "Revoke",
    },
    done: {
      title: "✅ Access updated",
      bodyAdd: "{username} can now use /status, /start, /stop and /restart.",
      bodyRemove: "{username} no longer has operator access.",
    },
  },

  logs: {
    accessDenied: {
      title: "Access denied",
      body: "Only the configured owner can view logs.",
    },
    cardTitle: "📜 Logs",
    notFound: "Log file not found.",
    readFailed: "Could not read log file ({code}).",
    titleFiltered: "📜 {count} line(s) matching \"{filter}\"",
    titleLast: "📜 Last {count} log lines",
    nothingFiltered: "No lines matched \"{filter}\".",
    empty: "Log file is empty.",
  },

  watchdog: {
    down: {
      title: "🔴 Service **{name}** down",
      body: "State changed **running → {state}**.\nAddress: `{address}`.\nCheck the {provider} panel.",
    },
    highCpu: {
      title: "⚠ High CPU on **{name}**",
      body: "CPU: **{pct}%** (threshold {threshold}%).",
    },
    highRam: {
      title: "⚠ High memory on **{name}**",
      body: "RAM: **{pct}%** ({used}/{max} MB).",
    },
    highDisk: {
      title: "⚠ Disk almost full on **{name}**",
      body: "Disk: **{pct}%** ({used}/{max} MB).",
    },
  },

  setup: {
    intro: "\n🛠  First-time configuration detected — a few values are required.\n",
    fileLine: "   File: {envFile}\n\n",
    languageLabel: "Language / Langue [en/fr]",
    promptLine: "   {question} : ",
    promptLineHidden: "🔒 {question} : ",
    prompt: {
      discordToken: "Discord bot token",
      discordClientId: "Discord application ID",
      discordOwnerId: "Discord owner user ID",
      discordGuildId: "Discord guild ID",
      providerApiKey: "Provider API key",
      providerServiceId: "Service ID (single-target mode)",
      providerServices: "Services (multi-target alias=id, comma-separated)",
    },
    invalid: "   ⚠ Invalid value, please try again.\n",
    complete: "\n✅ Configuration saved to {envFile}\n\n",
  },

  errors: {
    missingConfig: "Missing configuration: {key}",
    missingServiceId: "Missing service ID for alias \"{alias}\"",
    invalidService: "Missing configuration: define PROVIDER_SERVICE_ID or PROVIDER_SERVICES",
    requestFailed: "Request failed{statusPart}{codePart}.{suffix}",
    requestFailedStatus: " • HTTP {status}",
    requestFailedCode: " • {code}",
    requestFailedPowerSuffix: " No automatic retry of power requests.",
    requestFailedAuth: "Authentication failed{statusPart}{codePart}. Your API key seems invalid or expired.{suffix}",
    requestFailedForbidden: "Access refused{statusPart}{codePart}. Check the API key scopes and permissions.{suffix}",
    requestFailedNotFound: "Target not found{statusPart}{codePart}. Check the service ID in the .env file.{suffix}",
    requestFailedRateLimit: "Rate limited{statusPart}{codePart}. The provider is temporarily refusing requests — try again later.{suffix}",
    requestFailedServer: "The provider returned an error{statusPart}{codePart}. Nothing was sent — try again or check the provider panel.{suffix}",
    requestFailedServerSent: "The provider returned an error after the request was sent{statusPart}{codePart}. The action may have been applied — check /status. No new request was sent.{suffix}",
    requestFailedTimeout: "The provider did not respond in time. Nothing was sent — check connectivity and try again.{suffix}",
    requestFailedTimeoutSent: "The provider did not respond in time after the request was sent. The action may have been applied — check /status. No new request was sent.{suffix}",
    requestFailedNetwork: "Could not reach the provider API (network error). Check connectivity and PROVIDER_API_URL.{suffix}",
    requestFailedReset: "The connection to the provider was interrupted (network error). Try again.{suffix}",
    requestFailedResetSent: "The connection was interrupted after the request was sent. The action may have been applied — check /status. No new request was sent.{suffix}",
    requestFailedGeneric: "Request failed. {message}{suffix}",
    setupIncompleteNonInteractive: "Configuration incomplete and --non-interactive was provided. Missing: {missing}. Fill {envFile} manually or provide the variables via the environment.",
    setupIncompleteNoTty: "Configuration incomplete and no interactive terminal available. Missing: {missing}. Fill {envFile} manually or provide the variables via the environment.",
    setupIncompleteCheck: "Configuration incomplete: \"{key}\" is empty and its alternative \"{alt}\" is not set.",
    invalidUsersJsonShape: "Invalid users.json (expected an array of Discord user IDs). Fix or delete the file, then restart.",
    deployMissingAccess: "Discord refused: Missing Access (50001). The bot is not present on guild {guild}, or DISCORD_CLIENT_ID does not match the token. Invite the bot: https://discord.com/oauth2/authorize?client_id={client}&scope=bot+applications.commands",
    deployUnknownApplication: "Discord refused: unknown application. DISCORD_CLIENT_ID={client} does not match any application for this token. Check the Application ID in the Discord developer portal.",
  },

  audit: {
    powerRequested: "Audit: power action '{action}' requested by {username} ({userId}) on service '{alias}'",
    powerSendFailed: "Audit: power send '{action}' to '{alias}' failed after {ms}ms: {error}",
    powerSendOk: "Audit: power send '{action}' to '{alias}' ok in {ms}ms",
    powerTrackingCancelled: "Audit: tracking of '{action}' on '{alias}' cancelled by the user",
    powerAppliedDespiteError: "Audit: action '{action}' on '{alias}' applied despite the send error (state {state})",
    powerSendErrorPolling: "Audit: power send '{action}' to '{alias}' errored — falling back to state tracking (no power retry): {error}",
    powerConfirmed: "Audit: power action '{action}' on '{alias}' confirmed by {provider} in {seconds}s",
    powerNotConfirmed: "Audit: power action '{action}' on '{alias}' not confirmed within 10 minutes (failures={failures})",
    operatorGranted: "Audit: operator {username} ({target}) granted by owner ({ownerId})",
    operatorRevoked: "Audit: operator {username} ({target}) revoked by owner ({ownerId})",
    operatorsCleared: "Audit: all operators cleared by owner ({ownerId})",
    commandsSkipped: "Slash commands unchanged, skipping registration.",
    commandsRegistered: "Slash commands registered.",
    commandsGlobalPurged: "Global commands purged (no global/guild duplicates possible).",
    commandsGlobalPurgeFailed: "Could not purge global commands: {error}",
    commandsOldGuildPurged: "Commands of previous guild {guild} purged.",
    commandsOldGuildPurgeFailed: "Could not purge commands of previous guild {guild}: {error}",
    commandsHashFailed: "Could not persist commands hash: {error}",
    watchdogDisabled: "Watchdog disabled (DISCORD_ALERT_CHANNEL_ID not set).",
    watchdogStarted: "Watchdog started (interval {interval}ms, channel {channel}).",
    watchdogAlertSent: "Watchdog: alert sent — {title}",
    watchdogAlertFailed: "Watchdog: could not send alert: {error}",
    watchdogCheckFailed: "Watchdog: check failed for '{alias}': {error}",
    lockWriteFailed: "Could not write lock file: {error}",
    sessionsWriteFailed: "Could not write sessions file: {error}",
    usersInvalidEntry: "Ignoring invalid entry in users.json: {entry}",
    usersNotArray: "users.json is not an array.",
  },
};
