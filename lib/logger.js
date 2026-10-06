"use strict";
const fs = require("node:fs");
const {logsDir, logFile} = require("./paths");
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 5;

// Couleurs uniquement si TTY réel et NO_COLOR non défini.
// (Sous systemd, PM2 ou redirection, stdout n'est pas un TTY => sortie sobre.)
const COLOR = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

const C = {
  reset:  "\x1b[0m",
  dim:    "\x1b[2m",
  gray:   "\x1b[90m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  cyan:   "\x1b[36m",
};

const ICON = {INFO: "•", WARN: "▲", ERROR: "✖"};
const TONE = {INFO: C.gray, WARN: C.yellow, ERROR: C.red};
const TAG  = {INFO: "INFO ", WARN: "WARN ", ERROR: "ERROR"};

function ensureDir() { try { fs.mkdirSync(logsDir, {recursive: true}); } catch {} }

// Vérification de la taille au plus une fois toutes les 30 s : évite un
// statSync par écriture (coût non négligeable en boucle de polling).
const ROTATE_CHECK_MS = 30_000;
let lastRotateCheck = 0;

function rotate() {
  const now = Date.now();
  if (now - lastRotateCheck < ROTATE_CHECK_MS) return;
  lastRotateCheck = now;
  try {
    if (fs.statSync(logFile).size < MAX_BYTES) return;
    for (let i = MAX_FILES - 1; i >= 1; i--) {
      const a = `${logFile}.${i}`, b = `${logFile}.${i + 1}`;
      if (fs.existsSync(a)) fs.renameSync(a, b);
    }
    fs.renameSync(logFile, `${logFile}.1`);
  } catch {}
}

function str(x) {
  if (typeof x === "string") return x;
  if (x instanceof Error) return x.stack || x.message;
  try { return JSON.stringify(x); } catch { return String(x); }
}

// Largeur d'affichage approximative (emoji = 2 colonnes, VS16 et ZWJ ignorés).
function visualWidth(s) {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xFE00 && cp <= 0xFE0F) continue;
    if (cp === 0x200D) continue;
    if (cp >= 0x1F300 || (cp >= 0x2600 && cp < 0x2800)) w += 2;
    else w += 1;
  }
  return w;
}

function pad(s, width) { return s + " ".repeat(Math.max(0, width - visualWidth(s))); }

function hhmmss(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function paint(s, c) { return COLOR ? c + s + C.reset : s; }

function write(level, args) {
  const now = new Date();
  const message = args.map(str).join(" ");

  // Fichier : ISO complet + tag fixe — stable, trié, grep-friendly.
  const fileLine = `${now.toISOString()} [${TAG[level]}] ${message}\n`;
  try { ensureDir(); rotate(); fs.appendFileSync(logFile, fileLine); } catch {}

  // Console : heure courte + icône + couleur (si TTY).
  const consoleLine = `${paint(hhmmss(now), C.dim)} ${paint(ICON[level], TONE[level])} ${message}\n`;
  if (level === "ERROR") process.stderr.write(consoleLine);
  else process.stdout.write(consoleLine);
}

// Bannière encadrée pour le démarrage. Écrite sur console ET fichier.
// Dans le fichier, chaque ligne est préfixée par le format standard
// `[ISO] [TAG] msg` pour rester grep-friendly (les outils externes qui
// filtrent par préfixe ne rateront pas la bannière).
function banner(lines) {
  const inner = Math.max(...lines.map(visualWidth)) + 2;
  const top = "╭" + "─".repeat(inner) + "╮";
  const bot = "╰" + "─".repeat(inner) + "╯";
  const mid = lines.map((l) => "│ " + pad(l, inner - 1) + "│").join("\n");
  const text = `${top}\n${mid}\n${bot}`;
  process.stdout.write(paint(text, C.cyan) + "\n");
  try {
    ensureDir();
    const iso = new Date().toISOString();
    const fileLines = [top, ...lines.map((l) => "│ " + pad(l, inner - 1) + "│"), bot]
      .map((l) => `${iso} [INFO ] ${l}`)
      .join("\n");
    fs.appendFileSync(logFile, fileLines + "\n");
  } catch {}
}

module.exports = {
  info:  (...a) => write("INFO",  a),
  warn:  (...a) => write("WARN",  a),
  error: (...a) => write("ERROR", a),
  banner,
};
