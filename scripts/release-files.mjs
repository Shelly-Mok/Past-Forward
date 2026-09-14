import { readdir, lstat } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
// Omit dependencies, browser state and transient test output. Keep the verified
// production build so an account handoff can inspect both source and deliverable.
export const releaseEntries = [
  '.github', '.gitignore', '.gitattributes', '.codex', 'AGENTS.md', 'README.md',
  'index.html', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json',
  'playwright.config.ts', 'vitest.config.ts', 'vite.config.ts',
  'src', 'public', 'dist', 'docs', 'scripts', 'server', 'tests', 'asset-sources',
]
export async function releaseFiles() {
  const files = []
  async function visit(path) {
    const info = await lstat(path)
    if (info.isSymbolicLink()) throw new Error(`Symlinks are not allowed in the handoff: ${relative(projectRoot, path)}`)
    if (info.isDirectory()) {
      for (const item of await readdir(path)) {
        if (['node_modules', '__pycache__', '.git'].includes(item) || item.endsWith('.pyc')) continue
        await visit(join(path, item))
      }
    } else if (info.isFile()) files.push(relative(projectRoot, path).replaceAll('\\', '/'))
  }
  for (const entry of releaseEntries) await visit(join(projectRoot, entry))
  return files.sort()
}
if (process.argv.includes('--json')) console.log(JSON.stringify(await releaseFiles()))
