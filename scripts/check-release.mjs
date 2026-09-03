import { readFile, stat, access } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { releaseFiles, projectRoot } from './release-files.mjs'

const files = await releaseFiles()
const issues = []
let bytes = 0
let largest = { path: '', size: 0 }
const textTypes = new Set(['.ts', '.css', '.html', '.json', '.yaml', '.yml', '.md', '.mjs', '.py', '.ps1'])
// Heuristic guard, not a substitute for reviewing the selected upload files.
const secretPatterns = [
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
]
for (const path of files) {
  const full = join(projectRoot, path)
  const { size } = await stat(full)
  bytes += size
  if (size > largest.size) largest = { path, size }
  if (size >= 100 * 1024 * 1024) issues.push(`${path}: exceeds the ordinary Git file limit`)
  if (/(?:^|\/)(?:\.env(?:\..*)?|[^/]*(?:storage.?state|auth.?state|cookies)[^/]*\.json)$|\.(?:pem|key|p12|pfx)$/i.test(path)) {
    issues.push(`${path}: possible credential or browser-state file`)
  }
  if (!textTypes.has(extname(path))) continue
  const text = await readFile(full, 'utf8')
  if (secretPatterns.some(pattern => pattern.test(text))) issues.push(`${path}: possible secret; inspect locally (value not printed)`)
  if (path.startsWith('src/')) {
    if (/[A-Z]:[\\/](?:Users|Program Files)[\\/]/.test(text)) issues.push(`${path}: machine-specific runtime path`)
    const assets = new Set([...text.matchAll(/['"`](\/(?:assets|concepts)\/[^'"`]+?\.(?:png|jpg|jpeg|webp|svg|mp3|ogg|wav))['"`]/g)].map(match => match[1]))
    for (const asset of assets) {
      try { await access(join(projectRoot, 'public', asset.slice(1))) }
      catch { issues.push(`${path}: missing public asset ${asset}`) }
    }
  }
}
console.log(`${files.length} handoff files; ${(bytes / 1024 / 1024).toFixed(2)} MiB`)
console.log(`Largest file: ${largest.path} (${(largest.size / 1024 / 1024).toFixed(2)} MiB)`)
if (issues.length) {
  console.error(issues.join('\n'))
  process.exitCode = 1
} else console.log('PASS: required assets found; no known secret pattern or oversized file detected. Human review is still required before publishing.')
