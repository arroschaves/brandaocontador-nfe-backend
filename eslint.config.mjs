export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
    ignores: [
      "frontend-remote/**",
      "node_modules/**",
      "logs/**",
      "pdfs/**",
      "xmls/**",
      "scripts/**",
    ],
  },
];
