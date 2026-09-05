import { officialSkillDir } from './install-zhihu-skill.mjs'
import { resolveCliPath, runCli, runSkillStatus } from './zhihu-lib.mjs'

const status = await runSkillStatus().catch(error => ({ ok: false, error: error.message }))
const cliPath = await resolveCliPath(status)
let version = status?.cli?.version || null
if (cliPath && !version) {
  try {
    const info = await runCli(['version'], 10000)
    version = info?.version || null
  } catch {
    /* version is optional */
  }
}
const report = {
  ok: Boolean(cliPath),
  project: 'life-backtest',
  skillDir: officialSkillDir,
  cli: {
    installed: Boolean(status?.installed || cliPath),
    binaryPath: cliPath,
    version,
    compatible: status?.compatible ?? null,
  },
  auth: {
    configured: Boolean(status?.auth?.configured),
    source: status?.auth?.source || null,
    verify: status?.auth?.verify || null,
  },
  next: !cliPath
    ? 'pnpm zhihu:setup'
    : status?.auth?.configured
      ? 'pnpm dev 后打开 /?zhihu=access'
      : '到 https://developer.zhihu.com/profile 生成 Access Secret，再运行 pnpm zhihu:auth',
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (!cliPath) process.exitCode = 2
