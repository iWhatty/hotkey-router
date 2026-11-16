// Keep agent worktrees under .claude/ out of the run: they are other
// branches' copies of this suite.
import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
