import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: ['docs/**', 'packages/server/docs/**'],
  react: true,
  typescript: true,
  rules: {
    'no-console': 'off',
  },
})
