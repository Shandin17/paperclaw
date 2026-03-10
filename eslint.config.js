import neostandard, { resolveIgnoresFromGitignore } from 'neostandard'

export default neostandard({
  ts: true,
  ignores: [
    ...resolveIgnoresFromGitignore(),
    '.agents/**',
    '.claude/**',
  ],
})
