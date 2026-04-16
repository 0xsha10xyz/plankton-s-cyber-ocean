const path = require("path");

/** PM2 must run the tsx CLI by path; `script: "tsx"` resolves to a non-existent file in project root. */
const tsxCli = path.join(__dirname, "node_modules", "tsx", "dist", "cli.mjs");

module.exports = {
  apps: [
    {
      name: "syraa-signal-agent",
      cwd: __dirname,
      script: tsxCli,
      args: "src/agent.ts",
      interpreter: "node",
      watch: false,
      env_file: ".env",
      restart_delay: 5000,
      max_restarts: 10,
      log_file: "./logs/agent.log",
      error_file: "./logs/agent-error.log",
      time: true
    }
  ]
};
