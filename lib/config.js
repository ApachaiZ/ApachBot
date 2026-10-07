"use strict";
const {t, lang} = require("./i18n");
const {isUnset, parseServices, pickService} = require("./services");
const {getProvider} = require("./providers");
const {envFile} = require("./paths");

require("dotenv").config({path: envFile});

const providerName = process.env.PROVIDER || "yorkhost";
const provider = getProvider(providerName);

const apiKey = process.env.PROVIDER_API_KEY;
const apiUrl = process.env.PROVIDER_API_URL || provider.defaultApiUrl;
const services = parseServices(process.env.PROVIDER_SERVICES, process.env.PROVIDER_SERVICE_ID);
const aliases = Object.keys(services);
const defaultAlias = aliases[0];

const cfg = {
  token: process.env.DISCORD_TOKEN,
  client_id: process.env.DISCORD_CLIENT_ID,
  owner_id: process.env.DISCORD_OWNER_ID,
  guild_id: process.env.DISCORD_GUILD_ID,
  alert_channel_id: process.env.DISCORD_ALERT_CHANNEL_ID,
  alert_interval_ms: process.env.ALERT_INTERVAL_MS,

  // Provider (type de serveur)
  provider: provider.name,
  provider_label: provider.displayName,
  provider_kind: provider.kind,
  provider_icon: provider.icon,
  api_key: apiKey,
  api_url: apiUrl,

  // Services (cibles pilotées via ce provider)
  services,
  service_id: defaultAlias ? services[defaultAlias] : undefined,

  // Langue active (résolue par i18n.js)
  language: lang,
};

// Erreur de configuration marquée exitCode 78 (EX_CONFIG) : PM2 ne redémarre
// pas en boucle sur une config invalide (stop_exit_codes: [78]).
function configError(msg) {
  const e = new Error(msg);
  e.exitCode = 78;
  return e;
}

const ENV_KEYS = {
  token: "DISCORD_TOKEN",
  client_id: "DISCORD_CLIENT_ID",
  owner_id: "DISCORD_OWNER_ID",
  guild_id: "DISCORD_GUILD_ID",
};
for (const [k, envName] of Object.entries(ENV_KEYS)) {
  if (isUnset(cfg[k])) throw configError(t("errors.missingConfig", {key: envName}));
}
if (isUnset(apiKey)) throw configError(t("errors.missingConfig", {key: "PROVIDER_API_KEY"}));
if (!defaultAlias) throw configError(t("errors.invalidService"));
for (const [alias, id] of Object.entries(services)) {
  if (isUnset(id)) throw configError(t("errors.missingServiceId", {alias}));
}

function resolveService(alias) {
  return pickService(services, defaultAlias, alias);
}

module.exports = {cfg, resolveService, provider};
