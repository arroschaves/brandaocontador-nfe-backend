module.exports = {
  apps: [
    {
      name: "nfe-service",
      script: "./app-real.js",
      env: {
        NODE_ENV: "production",
        CERT_PATH: "",
        CERT_PASS: "",
        UF: "",
        CNPJ_EMITENTE: "",
        AMBIENTE: "1",
        SECRET_JWT: "brandao-contador-nfe-production-secret-2024"
      }
    },
    {
      name: "nfe-service-simple",
      script: "./app-simples.js",
      env: {
        NODE_ENV: "development",
        MODE: "simple",
        PORT: "3002",
        JWT_SECRET: "brandaocontador-nfe-secret-key-2024"
      }
    }
  ]
};
