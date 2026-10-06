"use strict";

// Configuration PM2 pour apach-bot.
// Usage :
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup      (démarrage auto au boot)
//
// Note : une seule instance — le bot maintient une connexion gateway Discord unique.
// Le mode cluster de PM2 n'est pas utilisable ici.

module.exports = {
  apps: [{
    name: "apach-bot",
    script: "apach-bot.js",
    args: "--non-interactive",
    cwd: __dirname,

    // Mono-processus, pas de cluster (gateway Discord = 1 connexion).
    instances: 1,
    exec_mode: "fork",

    // Redémarrage automatique (équivalent systemd Restart=on-failure).
    autorestart: true,
    max_restarts: 10,
    min_uptime: "30s",
    restart_delay: 5000,

    // Une erreur de configuration (exit 78, EX_CONFIG) ne relance PAS le
    // processus : redémarrer en boucle ne réparera jamais un .env incomplet.
    // Les vrais crashes (exit 1, etc.) continuent d'être relancés.
    stop_exit_codes: [78],

    // Délai laissé au handler SIGTERM (client.destroy + close état).
    kill_timeout: 10000,

    // Auto-restart si fuite mémoire (>300 Mo).
    max_memory_restart: "300M",

    // Capture stdout/stderr dans des fichiers dédiés (--time désactivé : notre logger timestampe déjà).
    merge_logs: true,
    time: false,
    out_file: "./logs/pm2-out.log",
    error_file: "./logs/pm2-error.log",

    env: {
      // Posé par convention (non consommé par le code aujourd'hui).
      NODE_ENV: "production",
    },
  }],
};
