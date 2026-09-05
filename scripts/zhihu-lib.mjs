import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { officialSkillDir } from './install-zhihu-skill.mjs'

const execFileAsync = promisify(execFile)
export const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

export function skillRunScript() {
  return process.platform === 'win32'
    ? path.join(officialSkillDir, 'scripts', 'run.ps1')
    : path.join(officialSkillDir, 'scripts', 'run.sh')
}

export function skillSetupScript() {
  return process.platform === 'win32'
    ? path.join(officialSkillDir, 'scripts', 'setup.ps1')
    : path.join(officialSkillDir, 'scripts', 'setup.sh')
}

export function parseJsonLine(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index])
    } catch {
      /* keep looking for the last JSON object */
    }
  }
  return null
}

export async function runSkillStatus() {
  const script = skillRunScript()
  if (!existsSync(script)) throw new Error('项目内官方 zhihu Skill 缺失，请先运行 pnpm zhihu:skill')
  const command = process.platform === 'win32'
    ? await execFileAsync('powershell', ['-ExecutionPolicy', 'Bypass', '-File', script, 'status'], { timeout: 20000 })
    : await execFileAsync('/bin/bash', [script, 'status'], { timeout: 20000 })
  return parseJsonLine(command.stdout) || {}
}

export function candidateCliPaths(status) {
  const home = homedir()
  return [
    process.env.ZHIHU_CLI_BIN,
    status?.cli?.binary_path,
    path.join(home, 'Library/Application Support/zhihu-cli/current/zhihu-cli'),
    path.join(home, '.local/share/zhihu-cli/current/zhihu-cli'),
  ].filter(Boolean)
}

export async function resolveCliPath(status) {
  const snapshot = status || await runSkillStatus().catch(() => null)
  for (const candidate of candidateCliPaths(snapshot)) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

export async function runCli(args, timeout = 30000) {
  const cli = await resolveCliPath()
  if (!cli) throw new Error('zhihu-cli 不可用，请先运行 pnpm zhihu:setup')
  try {
    const { stdout } = await execFileAsync(cli, args, { timeout })
    return parseJsonLine(stdout)
  } catch (error) {
    const parsed = parseJsonLine(error.stdout)
    if (parsed) return parsed
    const detail = String(error.stderr || error.stdout || error.message || '').trim()
    throw new Error(detail || 'zhihu-cli 调用失败')
  }
}
