const js = require('@eslint/js');
const globals = require('globals');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.jest,
            },
        },
    },
    {
        files: ['dragon.js', 'admin.js', 'js/**/*.js', 'sw.js', 'landing.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.jest,
                Chart: 'readonly',
                XLSX: 'readonly',
                io: 'readonly',
                showToast: 'readonly',
            },
        },
    },
    {
        rules: {
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^err$',
                    caughtErrorsIgnorePattern: '^err$',
                },
            ],
            'no-undef': 'warn',
            'no-console': 'off',
        },
    },
    eslintConfigPrettier,
];
