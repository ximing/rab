module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'jest'],
    extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:react/recommended',
        'plugin:jsx-a11y/recommended',
        'airbnb',
        'prettier',
        'prettier/@typescript-eslint'
    ],
    parserOptions: {
        project: './tsconfig.json'
    },
    globals: {
        Taro: true,
        Page: true,
        Component: true,
        App: true,
        wx: true,
        getApp: true,
        getCurrentPages: true,
        Behavior: true,
        jest: true,
        R: true,
        __wxAppBasePage: true,
        mmp: true
    },
    settings: {
        react: {
            pragma: 'Taro',
            version: '15.0'
        },
        'import/resolver': {
            node: {
                extensions: ['.js', '.jsx', '.ts', '.tsx']
            }
        }
    },
    rules: {
        'max-lines': ['error', { max: 1200, skipComments: true, skipBlankLines: true }],
        'import/no-extraneous-dependencies': 'off',
        'react/prop-types': 'off',
        'jest/no-disabled-tests': 'warn',
        'jest/no-focused-tests': 'error',
        'jest/no-identical-title': 'error',
        'jest/prefer-to-have-length': 'warn',
        'jest/valid-expect': 'error',
        'react/react-in-jsx-scope': 'off',
        'react/jsx-filename-extension': 'off',
        'react/jsx-no-undef': 'off',
        'react/jsx-indent': 'off',
        'react/style-prop-object': 'off',
        'react/no-access-state-in-setstate': 'off',
        'no-shadow': 'off',
        calemcase: 'off',
        'class-methods-use-this': 'off',
        'react/destructuring-assignment': 'off',
        'consistent-return': 'off',
        'array-callback-return': 'off',
        'import/named': 'off',
        'import/prefer-default-export': 1,
        'one-var': 'off',
        'no-underscore-dangle': 'off',
        'no-plusplus': 'off',
        'react/jsx-tag-spacing':'off',
        'react/jsx-wrap-multilines':'off',
        camelcase: 1,
        'no-console': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        'no-empty': 1,
        'no-unused-expressions': 1,
        'no-multi-assign': 'off',
        'import/first': 1,
        'prefer-promise-reject-errors': 1,
        'import/extensions': 'off',
        'prefer-const': 1,
        '@typescript-eslint/interface-name-prefix': 1,
        'no-restricted-properties': [
            2,
            {
                object: 'Proxy'
            },
            {
                object: 'Array',
                property: 'includes',
                message: '请使用indexOf代替'
            },
            {
                object: 'String',
                property: 'normalize'
            },
            {
                object: 'Object',
                property: 'values',
                message: '请使用Object.keys().map()代替'
            }
        ],
        'no-unused-vars': 'off',
        'lines-between-class-members': 'off',
        'no-bitwise': 'off',
        'no-restricted-syntax': 1,
        'no-param-reassign': 1,
        'no-nested-ternary': 1,
        'no-control-regex': 'off',
        'react/no-unknown-property': 'off',
        'react/jsx-one-expression-per-line': 'off',
        'react/button-has-type': 'off',
        'spaced-comment': 'off',
        'react/sort-comp': 'off',
        'no-useless-constructor': 'off',
        'react/jsx-indent-props': 'off',
        '@typescript-eslint/no-explicit-any':'off',
        'no-param-reassign':'off',
        '@typescript-eslint/array-type':'off',
        '@typescript-eslint/explicit-member-accessibility': 'off',
        'react/no-array-index-key':'off',
        '@typescript-eslint/no-non-null-assertion':"off"
    }
};
