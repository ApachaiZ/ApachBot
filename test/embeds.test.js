"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {bar, fmt, fmtDuration, state, online, offline, dashboard} = require("../lib/embeds");
const {t} = require("../lib/i18n");

test("fmtDuration: formate jours/heures/minutes", () => {
  assert.equal(fmtDuration(59), "0m");
  assert.equal(fmtDuration(3600), "1h 0m");
  assert.equal(fmtDuration(12240), "3h 24m");
  assert.equal(fmtDuration(90061), "1d 1h");
  assert.equal(fmtDuration(null), "0m");
  assert.equal(fmtDuration(-5), "0m");
});

test("bar: format des pourcentages", () => {
  assert.equal(bar(5, 10), "▰▰▰▰▰▱▱▱▱▱ 50.0%");
  assert.equal(bar(0, 100), "▱▱▱▱▱▱▱▱▱▱ 0.0%");
  assert.equal(bar(100, 100), "▰▰▰▰▰▰▰▰▰▰ 100.0%");
});

test("bar: clamp des valeurs hors bornes", () => {
  assert.equal(bar(200, 100), "▰▰▰▰▰▰▰▰▰▰ 100.0%");
  assert.equal(bar(-50, 100), "▱▱▱▱▱▱▱▱▱▱ 0.0%");
});

test("bar: Not reported sur données manquantes", () => {
  assert.equal(bar(null, 100), "Not reported");
  assert.equal(bar(5, 0), "Not reported");
  assert.equal(bar(5, null), "Not reported");
  assert.equal(bar(undefined, undefined), "Not reported");
});

test("fmt: formate les nombres", () => {
  assert.equal(fmt(1000), "1,000");
  assert.equal(fmt(0), "0");
});

test("fmt: N/A sur entrée invalide", () => {
  assert.equal(fmt(null), "N/A");
  assert.equal(fmt(undefined), "N/A");
  assert.equal(fmt("abc"), "N/A");
});

test("state: normalise en minuscules", () => {
  assert.equal(state({state: "Running"}), "running");
  assert.equal(state({}), "unknown");
});

test("online/offline: helpers d'état", () => {
  assert.equal(online({state: "running"}), true);
  assert.equal(online({state: "online"}), true);
  assert.equal(online({state: "offline"}), false);
  assert.equal(offline({state: "stopped"}), true);
  assert.equal(offline({state: "offline"}), true);
  assert.equal(offline({state: "running"}), false);
});

test("dashboard: construit sans erreur avec données complètes", () => {
  const e = dashboard({
    name: "srv", state: "running", cpuPct: 42, players: 12, uptimeSeconds: 12240,
    ramMb: 2048, ramMaxMb: 4096, diskMb: 8192, diskMaxMb: 20480,
    address: {ip: "1.2.3.4", port: 25565}, node: "n1"
  }, "alias");
  assert.ok(e);
  assert.equal(e.data.title, "🎮 srv", "le nom API prime sur l'alias");
  const byName = Object.fromEntries(e.data.fields.map((f) => [f.name, f.value]));
  assert.equal(byName[t("status.players")], "12", "joueurs affiché quand renseigné");
  assert.equal(byName[t("status.uptime")], "3h 24m", "uptime formaté quand renseigné");
  assert.match(byName[t("status.cpu")], /▰/);
  assert.match(byName[t("status.memory")], /2,048 \/ 4,096 MB/);
  assert.match(byName[t("status.storage")], /8,192 \/ 20,480 MB/);
  assert.equal(byName[t("status.address")], "1.2.3.4:25565");
  assert.equal(byName[t("status.node")], "n1");
  assert.equal(e.data.fields.length, 8, "7 métriques + 1 séparateur de lignes");
});

test("dashboard: deux paires inline consécutives restent sur deux lignes", () => {
  const e = dashboard({
    state: "running", players: 5, uptimeSeconds: 120,
    address: {ip: "1.2.3.4", port: 25565}, node: "n1"
  }, "alias");
  // Jamais plus de 2 champs inline consécutifs (sinon Discord regroupe en 3+1).
  let run = 0;
  for (const f of e.data.fields) {
    run = f.inline ? run + 1 : 0;
    assert.ok(run <= 2, `pas de rangée inline de plus de 2 champs (champ : ${f.name})`);
  }
  const idx = (n) => e.data.fields.findIndex((f) => f.name === n);
  const sep = e.data.fields.find((f) => f.name === "\u200b");
  assert.ok(sep && !sep.inline, "séparateur pleine largeur présent");
  assert.ok(idx(t("status.players")) < idx("\u200b") && idx("\u200b") < idx(t("status.address")));
});

test("dashboard: l'état est un libellé iconique localisé", () => {
  const e = dashboard({state: "running"}, "alias");
  assert.equal(e.data.description, t("status.stateRunning"));
});

test("dashboard: joueurs/uptime absents → champs masqués", () => {
  const e = dashboard({
    state: "running", cpuPct: 10, ramMb: 100, ramMaxMb: 200,
    address: {ip: "1.2.3.4", port: 25565}, node: "n1"
  }, "alias");
  const names = e.data.fields.map((f) => f.name);
  assert.ok(!names.includes(t("status.players")), "pas de champ joueurs");
  assert.ok(!names.includes(t("status.uptime")), "pas de champ uptime");
  assert.equal(names.length, 4, "CPU, RAM, adresse, nœud uniquement");
});

test("dashboard: une seule métrique de type chip → pleine largeur", () => {
  const e = dashboard({state: "running", players: 8}, "alias");
  const f = e.data.fields[0];
  assert.equal(f.name, t("status.players"));
  assert.equal(f.value, "8");
  assert.equal(f.inline, false, "un chip isolé occupe toute la largeur");
});

test("dashboard: joueurs + uptime présents → côte à côte", () => {
  const e = dashboard({state: "running", players: 5, uptimeSeconds: 120}, "alias");
  const players = e.data.fields.find((f) => f.name === t("status.players"));
  const uptime = e.data.fields.find((f) => f.name === t("status.uptime"));
  assert.equal(players.inline, true);
  assert.equal(uptime.inline, true);
  assert.equal(uptime.value, "2m");
});

test("dashboard: le CPU est affiché avec une barre visuelle", () => {
  const e = dashboard({state: "running", cpuPct: 42}, "alias");
  const cpu = e.data.fields.find((f) => f.name.includes("CPU"));
  assert.ok(cpu, "champ CPU présent");
  assert.match(cpu.value, /▰/);
  assert.match(cpu.value, /42\.0%/);
});

test("dashboard: aucune métrique renseignée → ligne notReported", () => {
  const e = dashboard({state: "running"}, "alias");
  assert.equal(e.data.fields.length, 1);
  assert.equal(e.data.fields[0].value, t("status.notReported"));
});

test("dashboard: titre = alias (pseudonyme) quand l'API ne fournit pas de nom", () => {
  const e = dashboard({state: "running"}, "mon-serveur");
  assert.equal(e.data.title, "🎮 mon-serveur");
});

test("dashboard: construit sans erreur avec données vides", () => {
  const e = dashboard({});
  assert.ok(e);
});
