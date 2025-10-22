module.exports = {
  apps: [
    {
      name: "nfe-service",
      script: "./app-real.js",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
        UF: "MS",
        AMBIENTE: "1",
        CNPJ_EMITENTE: "45669746000120",
        JWT_SECRET: "prod-secret-key-brandao-contador-nfe-2024",
        SIMULATION_MODE: "false",
        XML_SECURITY_VALIDATE: "true"
      }
    },
    {
      name: "nfe-service-simple",
      script: "./app-simples.js",
      env: {
        NODE_ENV: "production",
        MODE: "simple",
        PORT: "3002",
        UF: "MS",
        AMBIENTE: "1",
        CNPJ_EMITENTE: "45669746000120",
        JWT_SECRET: "prod-secret-key-brandao-contador-nfe-2024",
        CERT_PATH: "e\\\\PROJETOS\\\\brandaocontador-nfe\\\\backend\\\\certs\\\\teste-a1.pfx",
        CERT_PASS: "1234",
        SIMULATION_MODE: "false",
        XML_SECURITY_VALIDATE: "true"
      }
    }
  ]
};
