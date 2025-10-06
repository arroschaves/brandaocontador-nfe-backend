module.exports = {
  apps: [
    {
      name: "nfe-service",
      script: "./app-real.js",
      env: {
        NODE_ENV: "production",
        CERT_PATH: "./certs/MAP LTDA45669746000120.pfx",
        CERT_PASS: "1234",
        UF: "MS",
        CNPJ_EMITENTE: "45669746000120",
        AMBIENTE: "2",
        SECRET_JWT: "sua_chave_secreta_jwt_muito_longa_32_chars_min"
      }
    },
    {
      name: "nfe-service-simple",
      script: "./app-simples.js",
      env: {
        NODE_ENV: "development",
        MODE: "simple"
      }
    }
  ]
};
