import { resolveCliPath, runCli, runSkillStatus } from './zhihu-lib.mjs'

const status = await runSkillStatus()
const cli = await resolveCliPath(status)
const probes = [
  ['auth', ['auth', 'status', '--verify'], 20000],
  ['search', ['search', 'zhihu', '--query', '18岁 高考 复读还是上大学', '--count', '3'], 30000],
  ['hot', ['hot', '--limit', '3'], 20000],
  ['contents', ['me', 'contents', '--type', 'all', '--limit', '1'], 20000],
]

function probeOk(name, payload) {
  if (name === 'auth') return payload?.verification === 'valid'
  if (payload?.Code !== undefined) return payload.Code === 0
  return payload?.ok !== false
}

const results = {}
for (const [name, args, timeout] of probes) {
  try {
    const payload = await runCli(args, timeout)
    const items = payload?.Items || payload?.Data?.Items || []
    results[name] = {
      ok: probeOk(name, payload),
      sampleCount: Array.isArray(items) ? items.length : undefined,
      sampleTitle: items[0]?.Title || undefined,
    }
  } catch (error) {
    results[name] = { ok: false, error: error.message }
  }
}

const report = {
  ok: Boolean(results.auth?.ok && results.search?.ok),
  cli,
  authConfigured: Boolean(status?.auth?.configured),
  results,
  note: '「我的内容」空列表也算成功。密钥不会出现在这份报告里。',
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (!report.ok) process.exitCode = 1
