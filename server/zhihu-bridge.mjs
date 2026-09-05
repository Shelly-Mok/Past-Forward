import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const skillRun = path.join(root, '.codex', 'skills', 'zhihu', 'scripts', 'run.sh')
const skillRunWindows = path.join(root, '.codex', 'skills', 'zhihu', 'scripts', 'run.ps1')
const SEARCH_CACHE_MS = 10 * 60 * 1000
const ACCESS_CACHE_MS = 2 * 60 * 1000
const searchCache = new Map()
let accessCache = null
let cliPathPromise

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.end(JSON.stringify(payload))
}

function httpError(statusCode, message, code = 'ERROR') {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  return error
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function candidateCliPaths() {
  const home = homedir()
  return [
    process.env.ZHIHU_CLI_BIN,
    path.join(home, 'Library/Application Support/zhihu-cli/current/zhihu-cli'),
    path.join(home, '.local/share/zhihu-cli/current/zhihu-cli'),
  ].filter(Boolean)
}

async function resolveCliFromSkill() {
  try {
    const command = process.platform === 'win32'
      ? await execFileAsync('powershell', ['-ExecutionPolicy', 'Bypass', '-File', skillRunWindows, 'status'], { timeout: 15000 })
      : existsSync(skillRun)
        ? await execFileAsync('/bin/bash', [skillRun, 'status'], { timeout: 15000 })
        : null
    if (!command) return null
    const lines = String(command.stdout || '').trim().split(/\r?\n/).filter(Boolean)
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        const payload = JSON.parse(lines[index])
        if (payload?.cli?.binary_path) return payload.cli.binary_path
      } catch {
        /* keep looking for the last JSON object */
      }
    }
  } catch {
    return null
  }
  return null
}

async function resolveCliPath() {
  for (const candidate of candidateCliPaths()) {
    if (existsSync(candidate)) return candidate
  }
  return resolveCliFromSkill()
}

function getCliPath() {
  cliPathPromise ??= resolveCliPath()
  return cliPathPromise
}

async function runCli(args, timeout = 30000) {
  const cli = await getCliPath()
  if (!cli) throw httpError(503, 'zhihu-cli 不可用，请先安装官方 CLI 并配置 Access Secret。', 'CLI_UNAVAILABLE')
  try {
    const { stdout } = await execFileAsync(cli, args, { timeout })
    const payload = JSON.parse(stdout)
    if (payload && payload.ok === false && payload.error) {
      throw httpError(502, payload.error.message || '开放平台命令失败', payload.error.code || 'COMMAND_FAILED')
    }
    if (payload && payload.Code !== undefined && payload.Code !== 0) {
      throw httpError(502, payload.Message || `开放平台错误 ${payload.Code}`, `API_${payload.Code}`)
    }
    return payload && Object.prototype.hasOwnProperty.call(payload, 'Data') ? payload.Data : payload
  } catch (error) {
    if (error.statusCode) throw error
    let detail = error?.message || '命令执行失败'
    try {
      const raw = error.stdout || error.stderr
      if (raw) detail = JSON.parse(raw)?.error?.message || String(raw).trim() || detail
    } catch {
      /* keep detail */
    }
    throw httpError(502, detail, 'COMMAND_FAILED')
  }
}

async function readJsonBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw httpError(400, '请求体必须是合法 JSON。', 'BAD_JSON')
  }
}

function cacheGet(map, key) {
  const hit = map.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > SEARCH_CACHE_MS) {
    map.delete(key)
    return null
  }
  return hit.value
}

function cacheSet(map, key, value) {
  map.set(key, { at: Date.now(), value })
  return value
}

async function searchZhihu(query, count) {
  const key = `zhihu:${count}:${query}`
  const cached = cacheGet(searchCache, key)
  if (cached) return cached
  const data = await runCli(['search', 'zhihu', '--query', query, '--count', String(count)])
  return cacheSet(searchCache, key, data.Items || [])
}

async function handleHealth() {
  const cli = await getCliPath()
  let authConfigured = false
  if (cli) {
    try {
      const status = await runCli(['auth', 'status'], 15000)
      authConfigured = status?.ok !== false && Boolean(status?.source || status?.keychain)
    } catch {
      authConfigured = false
    }
  }
  return {
    ok: true,
    project: 'life-backtest',
    zhihu: {
      cli: Boolean(cli),
      authConfigured,
      skill: existsSync(skillRun) || existsSync(skillRunWindows),
      next: !cli
        ? 'pnpm zhihu:setup'
        : authConfigured
          ? 'ready'
          : 'pnpm zhihu:auth',
    },
  }
}

function summarizeContent(item) {
  return {
    title: item.Title || '',
    url: item.Url || '',
    type: item.ContentType || '',
    likes: item.LikeCount ?? item.VoteUpCount ?? 0,
    summary: String(item.Summary || item.ContentText || '').slice(0, 160),
    author: item.Author?.Name || item.AuthorName || '',
  }
}

async function handleAccess() {
  if (accessCache && Date.now() - accessCache.at < ACCESS_CACHE_MS) return accessCache.value
  const settled = await Promise.allSettled([
    runCli(['auth', 'status', '--verify'], 20000),
    runCli(['me', 'contents', '--type', 'all', '--limit', '5']),
    runCli(['me', 'followees', '--limit', '5']),
    runCli(['me', 'favorites', 'lists', '--limit', '10']),
    runCli(['me', 'favorites', 'recent', '--limit', '5']),
    runCli(['knowledge', 'bases', '--scope', 'all']),
    runCli(['search', 'zhihu', '--query', '18岁 高考 复读还是上大学', '--count', '3']),
    runCli(['hot', '--limit', '5']),
  ])
  const valueOf = (index) => (settled[index].status === 'fulfilled' ? settled[index].value : null)
  const errorOf = (index) => (settled[index].status === 'rejected' ? settled[index].reason?.message || '失败' : null)
  const contents = valueOf(1)
  const followees = valueOf(2)
  const lists = valueOf(3)
  const recent = valueOf(4)
  const knowledge = valueOf(5)
  const search = valueOf(6)
  const hot = valueOf(7)
  const kaoyan = (lists?.Items || []).find(item => item.Title === '考研')
  let kaoyanItems = []
  let kaoyanError = null
  if (kaoyan?.UrlToken) {
    try {
      const data = await runCli(['me', 'favorites', 'items', '--url-token', String(kaoyan.UrlToken), '--limit', '3'])
      kaoyanItems = data.Items || []
    } catch (error) {
      kaoyanError = error.message
    }
  }
  const value = {
    ok: true,
    generatedAt: new Date().toISOString(),
    identity: 'access_secret_owner',
    note: '下列「我的」数据属于 Access Secret 所属账号，不是游戏玩家 OAuth 登录账号。裂隙页匹配使用公开搜索。',
    auth: valueOf(0) || { ok: false, detail: errorOf(0) },
    capabilities: {
      searchZhihu: { available: !errorOf(6), dailyLimit: 5000, error: errorOf(6) },
      searchGlobal: { available: true, dailyLimit: 5000, note: '本页未探测，避免额外消耗额度' },
      hot: { available: !errorOf(7), dailyLimit: 100, error: errorOf(7) },
      answer: { available: true, dailyLimit: 100, note: '直答额度紧张，第一版裂隙匹配不调用' },
      meContents: { available: !errorOf(1), error: errorOf(1) },
      meFollowees: { available: !errorOf(2), error: errorOf(2) },
      meFavorites: { available: !errorOf(3) || !errorOf(4), error: errorOf(3) || errorOf(4) },
      knowledge: { available: !errorOf(5), error: errorOf(5) },
      stories: { available: false, note: '官方 CLI 尚未封装「知乎故事」' },
      oauth: { available: false, note: '当前仓库未接入玩家 OAuth，真实登录需公网回调' },
    },
    me: {
      contents: {
        totals: contents?.Paging?.Totals ?? (contents?.Items || []).length,
        samples: (contents?.Items || []).map(summarizeContent),
        error: errorOf(1),
      },
      followees: {
        totals: followees?.Paging?.Totals ?? (followees?.Items || []).length,
        samples: (followees?.Items || []).map(item => ({
          name: item.Fullname,
          headline: item.Headline,
          url: item.Url,
          followers: item.FollowerCount,
        })),
        error: errorOf(2),
      },
      favoriteLists: {
        items: (lists?.Items || []).map(item => ({
          title: item.Title,
          url: item.Url,
          public: item.IsPublic,
          token: item.UrlToken,
        })),
        error: errorOf(3),
      },
      recentFavorites: {
        samples: (recent?.Items || []).map(summarizeContent),
        error: errorOf(4),
      },
      favoriteSample: {
        list: kaoyan?.Title || null,
        samples: kaoyanItems.map(summarizeContent),
        error: kaoyanError,
      },
      knowledge: {
        items: (knowledge?.Items || []).map(item => ({
          name: item.Name,
          count: item.ContentCount,
          visibility: item.Visibility,
        })),
        error: errorOf(5),
      },
    },
    public: {
      searchQuery: '18岁 高考 复读还是上大学',
      searchSamples: (search?.Items || []).map(summarizeContent),
      hotSamples: (hot?.Items || []).map(item => ({
        title: item.Title,
        url: item.Url,
        summary: String(item.Summary || '').slice(0, 160),
      })),
    },
  }
  accessCache = { at: Date.now(), value }
  return value
}

async function handleMatch(body) {
  const queries = Array.isArray(body.queries)
    ? body.queries.map(item => String(item || '').trim()).filter(Boolean).slice(0, 3)
    : []
  const query = String(body.query || queries[0] || '').trim().slice(0, 100)
  if (!query && !queries.length) throw httpError(400, '缺少搜索关键词 query。', 'QUERY_REQUIRED')
  const count = clampInt(body.count, 1, 10, 8)
  const seen = new Set()
  const items = []
  for (const next of queries.length ? queries : [query]) {
    const batch = await searchZhihu(next.slice(0, 100), count)
    for (const item of batch) {
      const id = item.ContentID || item.Url
      if (!id || seen.has(id)) continue
      seen.add(id)
      items.push(item)
    }
  }
  return { ok: true, query: queries[0] || query, items }
}

async function handleAuthor(url) {
  const name = String(url.searchParams.get('name') || '').trim().slice(0, 40)
  const hint = String(url.searchParams.get('hint') || '').trim().slice(0, 40)
  if (!name) throw httpError(400, '缺少作者 name。', 'NAME_REQUIRED')
  const query = hint ? `${name} ${hint}` : name
  const items = await searchZhihu(query, 6)
  return { ok: true, query, items }
}

export async function handleZhihuApi(request, response) {
  const host = request.headers.host || '127.0.0.1'
  const url = new URL(request.url, `http://${host}`)
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, await handleHealth())
      return true
    }
    if (request.method === 'GET' && url.pathname === '/api/zhihu/access') {
      sendJson(response, 200, await handleAccess())
      return true
    }
    if (request.method === 'POST' && url.pathname === '/api/life/match') {
      sendJson(response, 200, await handleMatch(await readJsonBody(request)))
      return true
    }
    if (request.method === 'GET' && url.pathname === '/api/life/author') {
      sendJson(response, 200, await handleAuthor(url))
      return true
    }
    if (url.pathname.startsWith('/api/')) {
      sendJson(response, 404, { ok: false, error: 'NOT_FOUND' })
      return true
    }
    return false
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      ok: false,
      error: error.code || 'ERROR',
      detail: error.message,
    })
    return true
  }
}
