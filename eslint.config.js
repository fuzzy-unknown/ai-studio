import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: ['docs/**'],
  react: true,
  typescript: true,
  rules: {
    'no-console': 'off',
  },
})
