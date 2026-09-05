import { spawn } from 'node:child_process'
import readline from 'node:readline'
import { resolveCliPath, runSkillStatus } from './zhihu-lib.mjs'

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      const chunks = []
      process.stdin.on('data', chunk => chunks.push(chunk))
      process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8').trim()))
      process.stdin.on('error', reject)
      return
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    process.stdout.write(prompt)
    process.stdin.setRawMode?.(true)
    let value = ''
    const finish = (result, error) => {
      process.stdin.setRawMode?.(false)
      process.stdin.off('data', onData)
      process.stdout.write('\n')
      rl.close()
      if (error) reject(error)
      else resolve(result)
    }
    const onData = buffer => {
      const text = buffer.toString('utf8')
      if (text === '\n' || text === '\r' || text === '\u0004') return finish(value)
      if (text === '\u0003') return finish('', new Error('cancelled'))
      if (text === '\u007f' || text === '\b') {
        value = value.slice(0, -1)
        return
      }
      if (text >= ' ') value += text
    }
    process.stdin.on('data', onData)
  })
}

process.stderr.write('打开 https://developer.zhihu.com/profile 生成 Access Secret。\n')
process.stderr.write('值只写入本机 zhihu-cli 钥匙串，不会写进仓库或日志。\n')

let first = await readHidden('Access Secret: ')
if (process.stdin.isTTY) {
  const second = await readHidden('再输入一遍: ')
  if (first !== second) {
    process.stderr.write('两次输入不一致，已取消。Secret 不会被保存。\n')
    process.exit(1)
  }
}
if (!first) {
  process.stderr.write('没有读到 Access Secret。\n')
  process.exit(1)
}

const cli = await resolveCliPath()
if (!cli) {
  process.stderr.write('zhihu-cli 不可用，请先运行 pnpm zhihu:setup。\n')
  process.exit(1)
}

const child = spawn(cli, ['auth', 'set', '--secret-stdin'], { stdio: ['pipe', 'pipe', 'pipe'] })
child.stdin.write(`${first}\n`)
child.stdin.end()
first = ''
const exitCode = await new Promise(resolve => child.on('close', resolve))
if (exitCode !== 0) {
  process.stderr.write('Access Secret 写入失败。请确认值来自开放平台个人中心，不要把 App ID 或 OAuth App Key 当成 Access Secret。\n')
  process.exit(exitCode || 1)
}

const status = await runSkillStatus().catch(() => null)
process.stdout.write(`${JSON.stringify({
  ok: true,
  authConfigured: Boolean(status?.auth?.configured),
  source: status?.auth?.source || 'keychain',
  next: 'pnpm zhihu:verify',
}, null, 2)}\n`)
