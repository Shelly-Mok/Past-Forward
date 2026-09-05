import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const bundledZip = path.join(projectRoot, 'scripts', 'vendor', 'zhihu-cli-skill.zip')
export const expectedSha256 = 'be08e10bbd8f7c554456599e1bdf9e4a4f9216a7624d0b29218e9e4dc1c2f9f3'
export const officialSkillDir = path.join(projectRoot, '.codex', 'skills', 'zhihu')

function execFileResult(file, args, options = {}) {
  return new Promise(resolve => {
    execFile(file, args, { ...options, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        exitCode: error?.code ?? 0,
        stdout: stdout?.toString().trim() || '',
        stderr: stderr?.toString().trim() || '',
      })
    })
  })
}

async function validateArchive() {
  const bytes = await readFile(bundledZip)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (sha256 !== expectedSha256) throw new Error('Bundled official Skill checksum mismatch.')
  const listing = await execFileResult('/usr/bin/unzip', ['-Z1', bundledZip])
  if (!listing.ok) throw new Error('Unable to inspect bundled official Skill archive.')
  const entries = listing.stdout.split(/\r?\n/).filter(Boolean)
  if (!entries.includes('zhihu/SKILL.md')) throw new Error('Official Skill archive is missing zhihu/SKILL.md.')
  if (entries.some(entry => !entry.startsWith('zhihu/') || entry.startsWith('/') || entry.split('/').includes('..'))) {
    throw new Error('Official Skill archive contains an unsafe path.')
  }
  return { sha256, entries: entries.length }
}

export async function installOfficialSkill() {
  const archive = await validateArchive()
  const tempDir = await mkdtemp(path.join(tmpdir(), 'life-backtest-zhihu-skill-'))
  const targetSkillsDir = path.dirname(officialSkillDir)
  try {
    const unzip = await execFileResult('/usr/bin/unzip', ['-q', bundledZip, '-d', tempDir])
    if (!unzip.ok) throw new Error('Unable to extract bundled official Skill.')
    const extracted = path.join(tempDir, 'zhihu')
    const files = await readdir(extracted)
    if (!files.includes('SKILL.md')) throw new Error('Extracted official Skill is incomplete.')
    await mkdir(targetSkillsDir, { recursive: true })
    await rm(officialSkillDir, { recursive: true, force: true })
    await cp(extracted, officialSkillDir, { recursive: true })
    return { target: officialSkillDir, ...archive }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify({ ok: true, ...(await installOfficialSkill()) })}\n`)
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: error.message })}\n`)
    process.exit(1)
  }
}
