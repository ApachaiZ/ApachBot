"use strict";

// Classification PARTAGÉE des erreurs axios. interaction.js (messages affichés)
// et power.js (décision : erreur immédiate vs bascule sur le suivi d'état)
// doivent classer IDENTIQUEMENT une même erreur : ce module est la source de
// vérité. Ne requiert aucun autre module du projet (aucun cycle possible).

const TIMEOUT_CODES = new Set(["ECONNABORTED", "ETIMEDOUT", "ERR_CANCELED", "ERR_TIMEOUT"]);
// Connexion jamais établie : la requête n'a PAS pu partir.
const UNREACHABLE_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ERR_NETWORK"]);
// Connexion interrompue APRÈS un envoi potentiel : la requête a pu partir.
const RESET_CODES = new Set(["ECONNRESET", "ERR_CONNECTION_RESET", "ERR_SOCKET_CLOSED"]);

function classify(err = {}) {
  return {
    status: err.response?.status,
    code: err.response?.data?.code,
    networkCode: err.code,
    isTimeout: TIMEOUT_CODES.has(err.code),
    isUnreachable: UNREACHABLE_CODES.has(err.code),
    isReset: RESET_CODES.has(err.code),
  };
}

// L'action a-t-elle pu être transmise au provider malgré l'erreur ?
// - 4xx : le provider a REJETÉ la requête avant exécution → non.
// - 5xx : la réponse est arrivée APRÈS un traitement possible → oui.
// - timeout / connexion interrompue : la requête a pu partir → oui.
// - réseau injoignable / erreur sans statut HTTP : rien n'a pu partir → non.
function mayHaveBeenTransmitted(err) {
  const {status, isTimeout, isReset} = classify(err);
  if (isTimeout || isReset) return true;
  if (status != null) return status >= 500;
  return false;
}

module.exports = {classify, mayHaveBeenTransmitted};
