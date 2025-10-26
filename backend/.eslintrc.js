module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    // Possíveis erros
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'no-undef': 'error',
    'no-unreachable': 'error',
    'no-duplicate-imports': 'error',

    // Melhores práticas
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-return-assign': 'error',
    'no-self-compare': 'error',
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    'require-await': 'error',

    // Estilo de código
    'indent': ['error', 2, { SwitchCase: 1 }],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'comma-spacing': ['error', { before: false, after: true }],
    'comma-style': ['error', 'last'],
    'key-spacing': ['error', { beforeColon: false, afterColon: true }],
    'keyword-spacing': ['error', { before: true, after: true }],
    'space-before-blocks': ['error', 'always'],
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always'
    }],
    'space-in-parens': ['error', 'never'],
    'space-infix-ops': 'error',
    'space-unary-ops': ['error', { words: true, nonwords: false }],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'camelcase': ['error', { properties: 'never' }],
    'max-len': ['warn', { 
      code: 100, 
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true
    }],
    'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
    'max-params': ['warn', 5],
    'max-depth': ['warn', 4],
    'complexity': ['warn', 10],

    // ES6+
    'arrow-spacing': ['error', { before: true, after: true }],
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    'template-curly-spacing': ['error', 'never'],

    // Node.js específico
    'no-process-exit': 'error',
    'no-path-concat': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true
      },
      rules: {
        'no-console': 'off',
        'max-lines': 'off'
      }
    },
    {
      files: ['scripts/**/*.js'],
      rules: {
        'no-console': 'off',
        'no-process-exit': 'off'
      }
    }
  ]