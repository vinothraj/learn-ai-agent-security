// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Bundle size: the package root pulls in every icon. Add icons to src/components/icons.ts instead.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/icons.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: 'lucide-react-native', message: "Import icons from '@/components/icons'.", allowTypeImports: true }] }],
    },
  },
]);
