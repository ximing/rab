module.exports = {
  '*.{js,jsx,ts,tsx}': ['eslint --fix', 'prettier --write'],
  'src/**/*.{ts,tsx}': ['npm run typecheck'],
  '*.{md,html,css}': ['prettier --write']
};
