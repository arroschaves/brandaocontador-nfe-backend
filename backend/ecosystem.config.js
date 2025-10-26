module.exports = {
  apps: [
    {
      name: "brandaocontador-nfe-backend",
      script: "./app-real.js",
      cwd: "/var/www/brandaocontador-nfe-backend",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env_file: ".env",
      env: {
        NODE_ENV: "development",
        SIMULATION_MODE: "true",
        PORT: 3001,
        CERT_PASSWORD: "1234"
      }
    }
  ]
};