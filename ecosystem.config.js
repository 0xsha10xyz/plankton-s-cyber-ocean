module.exports = {
  apps: [
    {
      name: "syraa-signal-agent",
      script: "tsx",
      args: "src/agent.ts",
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

