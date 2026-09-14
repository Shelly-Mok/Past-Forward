import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export function loadProjectEnv() {
  try {
    const envPath = join(root, '.env')
    if (!existsSync(envPath)) return
    const text = readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '')
    for (const line of text.split(/\r?\n/)) {
      const matched = line.match(/^([^#=]+)=(.*)$/)
      if (!matched) continue
      const key = matched[1].trim()
      if (!key || process.env[key]) continue
      process.env[key] = matched[2].trim()
    }
  } catch {
    /* .env is optional */
  }
}

loadProjectEnv()
