import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import { installOfficialSkill, officialSkillDir } from './install-zhihu-skill.mjs'
import { parseJsonLine, resolveCliPath, runSkillStatus, skillSetupScript } from './zhihu-lib.mjs'

const execFileAsync = promisify(execFile)

async function ensureSkill() {
  if (existsSync(officialSkillDir)) return { installed: false, reused: true, target: officialSkillDir }
  return { installed: true, ...(await installOfficialSkill()) }
}

async function ensureCli() {
  const before = await runSkillStatus()
  const existing = await resolveCliPath(before)
  if (existing && before.compatible !== false) {
    return { setup: false, binaryPath: existing, status: before }
  }
  const script = skillSetupScript()
  const command = process.platform === 'win32'
    ? await execFileAsync('powershell', ['-ExecutionPolicy', 'Bypass', '-File', script], { timeout: 120000 })
    : await execFileAsync('/bin/bash', [script], { timeout: 120000 })
  const setup = parseJsonLine(command.stdout) || {}
  const after = await runSkillStatus()
  return {
    setup: true,
    binaryPath: setup.binary_path || await resolveCliPath(after),
    downloadedCliVersion: setup.downloaded_cli_version || after?.cli?.version || null,
    status: after,
  }
}

const skill = await ensureSkill()
const cli = await ensureCli()
const report = {
  ok: Boolean(cli.binaryPath),
  skill,
  cli: {
    binaryPath: cli.binaryPath,
    setupRan: cli.setup,
    version: cli.downloadedCliVersion || cli.status?.cli?.version || null,
    compatible: cli.status?.compatible ?? null,
  },
  auth: {
    configured: Boolean(cli.status?.auth?.configured),
    source: cli.status?.auth?.source || null,
  },
  next: cli.status?.auth?.configured
    ? 'pnpm dev 后打开 http://127.0.0.1:4174/?zhihu=access 验收真实接口'
    : '到 https://developer.zhihu.com/profile 生成 Access Secret，不要发给其他人。然后运行 pnpm zhihu:auth，按提示从标准输入写入，不要把 Secret 写进仓库。',
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (!cli.binaryPath) process.exit(1)
