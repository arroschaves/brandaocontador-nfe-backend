module.exports = {
  apps: [
    {
      name: "nfe-service",
      script: "./nfe-service.js",
      env: {
        NODE_ENV: "production",
        CERT_PATH: "./certs/MAP LTDA45669746000120.pfx",
        CERT_PASS: "1234",
        UF: "MS",
        CNPJ_EMITENTE: "45669746000120",
        AMBIENTE: "2"
      }
    }
  ]
};
