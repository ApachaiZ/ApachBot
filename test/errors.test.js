"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {classify, mayHaveBeenTransmitted} = require("../lib/errors");

test("errors: classify extrait status, code et networkCode", () => {
  const err = new Error("x");
  err.response = {status: 500, data: {code: "ERR"}};
  err.code = "ECONNABORTED";
  const c = classify(err);
  assert.equal(c.status, 500);
  assert.equal(c.code, "ERR");
  assert.equal(c.networkCode, "ECONNABORTED");
  assert.equal(c.isTimeout, true);
  assert.equal(c.isUnreachable, false);
  assert.equal(c.isReset, false);
});

test("errors: classify tolère un objet sans champs", () => {
  const c = classify({});
  assert.equal(c.status, undefined);
  assert.equal(c.isTimeout, false);
});

test("errors: mayHaveBeenTransmitted — timeout, reset et 5xx → vrai (la requête a pu partir)", () => {
  const cases = [
    {code: "ECONNABORTED"},
    {code: "ETIMEDOUT"},
    {code: "ECONNRESET"},
    {code: "ERR_CONNECTION_RESET"},
    {response: {status: 500}},
    {response: {status: 503}},
  ];
  for (const e of cases) {
    assert.equal(mayHaveBeenTransmitted(e), true, JSON.stringify(e));
  }
});

test("errors: mayHaveBeenTransmitted — 4xx, réseau injoignable et erreur sans statut → faux", () => {
  const cases = [
    {response: {status: 400}},
    {response: {status: 401}},
    {response: {status: 404}},
    {response: {status: 429}},
    {code: "ECONNREFUSED"},
    {code: "ENOTFOUND"},
    {code: "ERR_NETWORK"},
    {message: "plain business error"},
  ];
  for (const e of cases) {
    assert.equal(mayHaveBeenTransmitted(e), false, JSON.stringify(e));
  }
});
