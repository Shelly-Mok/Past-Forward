import './load-env.mjs'

const DEMO = [
  {
    id: 'demo-a',
    author: '另一条路上的人',
    headline: '种下的路和你写下的事件对上了。',
    quote: '我在那个年纪也站过差不多的路口。',
    source: 'demo',
  },
  {
    id: 'demo-b',
    author: '晚一点出发的人',
    headline: '学历和近况挨着，重合还浅。',
    quote: '后来才懂，当时看见的选项并不完整。',
    source: 'demo',
  },
  {
    id: 'demo-c',
    author: '先稳住再回头的人',
    headline: '同一类分叉，不是同一个人。',
    quote: '我没有走你走的那条，所以想听听你为什么走。',
    source: 'demo',
  },
]

function profileQueries(body) {
  if (Array.isArray(body.queries) && body.queries.length) {
    return body.queries.map(item => String(item || '').trim()).filter(Boolean).slice(0, 4)
  }
  const profile = body.profile || {}
  const planted = Array.isArray(body.planted) ? body.planted : []
  const gender = profile.gender === '男' || profile.gender === '女' ? profile.gender : ''
  const health = profile.health && !String(profile.health).startsWith('不透露') ? String(profile.health).trim() : ''
  const education = String(profile.education || '').trim()
  const event = String(profile.lifeEvent || '').trim()
  const age = body.currentAge ? `${body.currentAge}岁` : ''
  const last = planted.at(-1)
  const lastLabel = last ? String(last.label || last.choiceId || '').trim() : ''
  return [event, [age, gender, education, health].filter(Boolean).join(' '), lastLabel].filter(Boolean)
}

function autoReportReady(state) {
  const nodes = Array.isArray(state?.nodes) ? state.nodes : []
  return nodes.length > 0 && nodes.every(node => node.status === 'complete') && Boolean(state.closingConfirmed)
}

function authorizeReport(state, kind) {
  if (kind === 'full' && !autoReportReady(state)) {
    return { ok: false, status: 409, error: 'INCOMPLETE' }
  }
  return { ok: true, status: 200 }
}

async function chat(messages) {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    const error = new Error('缺少 OPENAI_API_KEY')
    error.statusCode = 503
    error.code = 'MODEL_UNAVAILABLE'
    throw error
  }
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai-next.com').replace(/\/$/, '')
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const response = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, temperature: 0.7 }),
  })
  if (!response.ok) {
    const error = new Error('模型请求失败')
    error.statusCode = 502
    error.code = 'MODEL_FAILED'
    throw error
  }
  const payload = await response.json()
  return String(payload?.choices?.[0]?.message?.content || '').trim()
}

function personalTagLines(body) {
  const tag = body.personalTag || {}
  const plans = String(tag.plans || '').trim()
  const notes = Array.isArray(tag.eventNotes)
    ? tag.eventNotes.map(item => {
      const age = item?.age != null ? `${item.age}岁` : ''
      const event = String(item?.event || '').trim()
      const note = String(item?.note || '').trim()
      if (!note) return ''
      return [age, event].filter(Boolean).join(' · ') + `：${note}`
    }).filter(Boolean).join('\n')
    : ''
  return [
    plans ? `用户写下的未来打算：${plans}` : '',
    notes ? `记下的事件（玩家原文）：\n${notes}` : '',
  ].filter(Boolean).join('\n')
}

function trailOf(path, planted) {
  return String(path || '').trim() || (Array.isArray(planted)
    ? planted.map(item => `${item.age}岁 · ${item.label || item.choiceId}`).join(' → ')
    : '')
}

function eventPrompt(body) {
  const event = body.event || {}
  const planted = Array.isArray(body.planted) ? body.planted : []
  const before = Array.isArray(body.before)
    ? body.before
    : planted.filter(item => event.age == null || Number(item.age) < Number(event.age))
  const after = planted.filter(item => event.age != null && Number(item.age) >= Number(event.age))
  const events = Array.isArray(body.events)
    ? body.events.map(item => `${item.age}岁 · ${item.text}`).join('；')
    : ''
  return [
    '你是月面档案里的时间记录员，也是站在同一节点上的另一个我。',
    '用这件事发生之前的选择当背景，把用户整条时间线和历史选择当作已知输入。',
    '先讲这件事里最核心的价值取向，再披露你在同一节点考虑过什么因素、得到什么、失去什么。',
    '代价和成就要分开写，不要编造用户没写过的具体经历。不要提到模型、知乎、检索。',
    event.age != null ? `当前重大事件：${event.age}岁 · ${event.text || ''}` : '',
    before.length ? `事件之前的选择（背景）：${before.map(item => `${item.age}岁 · ${item.label || item.choiceId}`).join(' → ')}` : '',
    after.length ? `事件及之后的选择：${after.map(item => `${item.age}岁 · ${item.label || item.choiceId}`).join(' → ')}` : '',
    events ? `登记过的事件：${events}` : '',
    trailOf(body.path, planted) ? `完整时间线：${trailOf(body.path, planted)}` : '',
    personalTagLines(body),
  ].filter(Boolean).join('\n')
}

const contexts = new Map()

function systemPrompt(persona, node, path, planted, extra = {}) {
  const posts = Array.isArray(persona?.posts) ? persona.posts.slice(0, 8) : []
  const corpus = posts.map(post => `- ${String(post.title || '').slice(0, 80)}：${String(post.excerpt || '').slice(0, 160)}`).join('\n')
  const when = node?.age != null ? `${node.age}岁${node.title ? ` · ${node.title}` : ''}` : ''
  const events = Array.isArray(extra.events)
    ? extra.events.map(item => `${item.age}岁 · ${item.text}`).join('；')
    : ''
  const alt = Array.isArray(extra.altTimeline)
    ? extra.altTimeline.map(item => item.text).filter(Boolean).join(' / ')
    : ''
  const talks = Array.isArray(extra.eventTalks)
    ? extra.eventTalks.map(item => {
      const lines = Array.isArray(item.lines)
        ? item.lines.map(line => `${line.who === 'you' ? '用户' : '记录员'}：${line.text}`).join('；')
        : ''
      return `${item.age}岁 · ${item.text}${lines ? `｜${lines}` : ''}`
    }).join('\n')
    : ''
  const asked = Array.isArray(extra.transcript)
    ? extra.transcript.map(item => `${item.who === 'you' ? '用户' : '另一个我'}：${item.text || ''}`).join('\n')
    : ''
  const lastYou = String(extra.lastYou || '').trim()
    || (Array.isArray(extra.transcript)
      ? [...extra.transcript].reverse().find(item => item.who === 'you')?.text
      : '')
  const prev = extra.previous?.age != null
    ? `${extra.previous.age}岁${extra.previous.title ? ` · ${extra.previous.title}` : ''}`
    : ''
  const round = Number(extra.round) || 0
  return [
    '你是平行宇宙版本的知乎用户【Z】。性格、思考方式和语言都来自公开文字。',
    '你和用户U前期成长环境一致，但在关键分叉点做了不一样的选择。',
    '这是同一场连续对话。先接住用户上一句，再往下问，不要生硬切到下一年。',
    '把第三幕重大事件对话、整条时间线、历史选择和刚才的问答都当成已知材料。',
    '顺着已经说开的话头，把「代价」和「成就」问清楚：代价是当时失去或交出的，成就是当时真正得到的。',
    '对人生重大事件，进一步追问并归纳它的核心原因。',
    '在收束前给出一段可执行的前瞻方法论：现年后怎么做小验证，而不是一次定终身。',
    '每次只问一个开放式问题。保持好奇，不评判。不要提到模型、知乎、检索。',
    '年份可以随着话头自然带出来。不要宣布「下一个节点」「我们换一年」。若要从另一年继续，先用用户刚说的那句话搭一座桥，再轻轻问过去。',
    '整段对话最多 10 轮用户发言。不要把全部上下文铺进回复。',
    round ? `现在是第 ${round} / 10 轮。` : '',
    lastYou ? `用户上一句：${lastYou}` : '',
    extra.shifted && prev && when
      ? `用户刚把 ${prev} 说清楚了一点。不要宣布换节点，先接住上一句，再轻轻问到 ${when}。`
      : when ? `这一轮可以落到：${when}。先接住上一句，再决定要不要问到这里。` : '',
    trailOf(path, planted) ? `完整时间线：${trailOf(path, planted)}` : '',
    events ? `重大事件：${events}` : '',
    talks ? `第三幕已经聊过的重大事件：\n${talks}` : '',
    alt ? `另一条时间线（只作对照）：${alt}` : '',
    asked ? `到目前为止的问答：\n${asked}` : '',
    personalTagLines(extra),
    corpus ? `公开文字摘要：\n${corpus}` : '没有公开文字时，仍用平行宇宙的口吻提问，不要编造具体经历。',
  ].filter(Boolean).join('\n')
}

function synthesisPrompt(body) {
  const planted = Array.isArray(body.planted) ? body.planted : []
  const events = Array.isArray(body.events)
    ? body.events.map(item => `${item.age}岁 · ${item.text}`).join('；')
    : ''
  const talks = Array.isArray(body.eventTalks)
    ? body.eventTalks.map(item => {
      const lines = Array.isArray(item.lines)
        ? item.lines.map(line => `${line.who === 'you' ? '用户' : '记录员'}：${line.text}`).join('；')
        : ''
      return `${item.age}岁 · ${item.text}${lines ? `｜${lines}` : ''}`
    }).join('\n')
    : ''
  const asked = Array.isArray(body.transcript)
    ? body.transcript.map(item => `${item.who === 'you' ? '用户' : '另一个我'}：${item.text || ''}`).join('\n')
    : ''
  const nodes = Array.isArray(body.nodes)
    ? body.nodes.map(item => `${item.age}岁 · ${item.title || ''}｜选择：${item.slots?.choice || ''}｜动因：${item.slots?.motive || ''}｜约束：${item.slots?.constraint || ''}｜备选：${item.slots?.alternative || ''}｜核验：${item.slots?.agency || ''}`).join('\n')
    : ''
  return [
    '根据用户整条时间线、第三幕重大事件对话、第四幕问答，整理每个事件节点的代价和成就。',
    '对人生重大事件写一句核心原因。再给一段可执行的前瞻方法论：现年后怎么做小验证。',
    '不要编造用户没写过的具体经历。不要提到模型、知乎、检索。',
    '只输出 JSON，不要 markdown。格式：{"nodes":[{"age":20,"title":"...","cost":"...","gain":"..."}],"eventReason":"...","method":"..."}',
    trailOf(body.path, planted) ? `完整时间线：${trailOf(body.path, planted)}` : '',
    events ? `重大事件：${events}` : '',
    talks ? `第三幕已经聊过的重大事件：\n${talks}` : '',
    nodes ? `访谈槽位：\n${nodes}` : '',
    asked ? `问答过程：\n${asked}` : '',
    personalTagLines(body),
  ].filter(Boolean).join('\n')
}

function eventYearPrompt(body) {
  const event = body.event || {}
  const planted = Array.isArray(body.planted) ? body.planted : []
  const before = planted.filter(item => event.age == null || Number(item.age) < Number(event.age))
  return [
    '你是月面花园里的零点小姐，说话短、干净，像在念一段时代旁白。',
    '根据用户亲口写下的重大人生事件，写这一年的时代描述，并推断当时还可能更希望走的另外几条路。',
    '不要编造用户没写过的具体人名、学校、公司和家庭细节。不要提到模型、知乎、检索。',
    '若有玩家写下的事件描述，按原文使用，不要编造没写过的细节。',
    '只输出 JSON，不要 markdown。格式：{"era":"两到四句旁白","ideals":[{"id":"hope-1","label":"短选择","reason":"一句原因"}]}',
    'ideals 给 3 到 5 条，label 不超过 16 字，不要用「记下这一岁」。era 不要重复用户原话整句，要点出那一年的空气和分岔。',
    event.age != null ? `当前重大事件：${event.age}岁 · ${event.text || ''}` : '',
    before.length ? `这一年之前已经种下的路：${before.map(item => `${item.age}岁 · ${item.label || item.choiceId}`).join(' → ')}` : '',
    personalTagLines(body),
  ].filter(Boolean).join('\n')
}

function parseEventYearReply(raw) {
  const text = String(raw || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < 0) return null
  try {
    const data = JSON.parse(text.slice(start, end + 1))
    const era = String(data?.era || '').trim().slice(0, 180)
    if (!era) return null
    const ideals = Array.isArray(data.ideals)
      ? data.ideals.flatMap((item, index) => {
        const label = String(item?.label || '').trim().slice(0, 24)
        if (!label || label === '记下这一岁') return []
        const id = String(item?.id || `ideal-${index}`).trim().slice(0, 32) || `ideal-${index}`
        return [{ id, label, reason: String(item?.reason || '').trim().slice(0, 80) }]
      }).slice(0, 5)
      : []
    return { era, ideals }
  } catch {
    return null
  }
}

function parseSynthesis(raw) {
  const text = String(raw || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < 0) return null
  try {
    const data = JSON.parse(text.slice(start, end + 1))
    if (!data || !Array.isArray(data.nodes)) return null
    return {
      nodes: data.nodes.map(item => ({
        age: Number(item.age),
        title: String(item.title || ''),
        cost: String(item.cost || ''),
        gain: String(item.gain || ''),
      })).filter(item => Number.isFinite(item.age)),
      eventReason: String(data.eventReason || ''),
      method: String(data.method || ''),
    }
  } catch {
    return null
  }
}

export async function handleLifeRoutes(request, response, url, deps) {
  const { searchPublic, sendJson, readJsonBody } = deps
  try {
    if (request.method === 'POST' && url.pathname === '/api/life/candidates') {
      const body = await readJsonBody(request)
      try {
        const seen = new Set()
        const people = []
        for (const query of profileQueries(body)) {
          const items = await searchPublic(query, 8)
          for (const item of items) {
            const author = String(item.AuthorName || item.Author?.Name || '').trim()
            if (!author || seen.has(author)) continue
            seen.add(author)
            people.push({
              id: author,
              author,
              headline: String(item.Title || '').slice(0, 80) || '公开检索到的相近经历',
              quote: String(item.ContentText || item.Summary || '').slice(0, 80),
              href: item.Url || '',
              identity: String(item.AuthorBadgeText || item.Author?.Headline || '').slice(0, 40),
              source: 'zhihu',
            })
            if (people.length >= 3) break
          }
          if (people.length >= 3) break
        }
        sendJson(response, 200, { ok: true, items: people.length ? people : DEMO })
      } catch {
        sendJson(response, 200, { ok: true, items: DEMO })
      }
      return true
    }
    if (request.method === 'POST' && url.pathname === '/api/life/persona') {
      const body = await readJsonBody(request)
      const author = String(body.author || '').trim()
      if (!author) {
        sendJson(response, 400, { ok: false, error: 'AUTHOR_REQUIRED' })
        return true
      }
      try {
        const items = await searchPublic(author, 6)
        sendJson(response, 200, {
          ok: true,
          posts: items.slice(0, 8).map(item => ({
            title: String(item.Title || '').slice(0, 80),
            excerpt: String(item.ContentText || item.Summary || '').slice(0, 200),
            href: item.Url || '',
          })),
        })
      } catch {
        sendJson(response, 200, { ok: true, posts: [] })
      }
      return true
    }
    if (request.method === 'POST' && url.pathname === '/api/life/alt-timeline') {
      const body = await readJsonBody(request)
      const ages = Array.isArray(body.ages) ? body.ages.map(item => Number(item)).filter(age => Number.isFinite(age)) : []
      const planted = Array.isArray(body.planted) ? body.planted : []
      const items = []
      try {
        for (const age of ages.slice(0, 12)) {
          const last = planted.filter(item => Number(item.age) < age).at(-1)
          const avoid = planted.filter(item => Number(item.age) === age).map(item => String(item.label || item.choiceId || ''))
          const query = [ `${age}岁`, last ? String(last.label || last.choiceId || '') : '', '之后选择' ].filter(Boolean).join(' ')
          const hits = await searchPublic(query, 6)
          let label = ''
          for (const hit of hits) {
            const title = String(hit.Title || '')
            const pair = title.match(/([\u4e00-\u9fff]{2,8})还是([\u4e00-\u9fff]{2,8})/)
            if (pair) label = avoid.some(item => pair[1].includes(item) || item.includes(pair[1])) ? pair[2] : pair[1]
            const chosen = title.match(/(?:我(?:选了|选择了|去了)|选择了)([\u4e00-\u9fffA-Za-z0-9·]{2,14})/)
            if (!label && chosen && !avoid.some(item => item.includes(chosen[1]))) label = chosen[1]
            if (label) break
          }
          if (label) items.push({ age, label: label.slice(0, 20) })
        }
        sendJson(response, 200, { ok: true, items })
      } catch {
        sendJson(response, 200, { ok: true, items })
      }
      return true
    }
    if (request.method === 'POST' && url.pathname === '/api/life/context') {
      const body = await readJsonBody(request)
      const id = String(body.id || 'default')
      contexts.set(id, {
        planted: body.planted ?? [],
        events: body.events ?? [],
        eventTalks: body.eventTalks ?? [],
        altTimeline: body.altTimeline ?? [],
        transcript: body.transcript ?? [],
      })
      sendJson(response, 200, { ok: true })
      return true
    }
    if (request.method === 'POST' && url.pathname === '/api/life/event-year') {
      const body = await readJsonBody(request)
      try {
        const reply = await chat([
          { role: 'system', content: eventYearPrompt(body) },
          { role: 'user', content: '请按指定 JSON 写出这一年的时代旁白，以及更希望走的几条路。' },
        ])
        const parsed = parseEventYearReply(reply)
        if (!parsed) {
          sendJson(response, 502, { ok: false, error: 'MODEL_FAILED' })
          return true
        }
        sendJson(response, 200, { ok: true, era: parsed.era, ideals: parsed.ideals })
      } catch (error) {
        sendJson(response, error.statusCode || 503, { ok: false, error: error.code || 'MODEL_UNAVAILABLE' })
      }
      return true
    }
    if (request.method === 'POST' && url.pathname === '/api/life/dialogue') {
      const body = await readJsonBody(request)
      const missing = body.missingSlot || 'choice'
      const eventMode = body.kind === 'event'
      try {
        const reply = await chat([
          { role: 'system', content: eventMode ? eventPrompt(body) : systemPrompt(body.persona, body.node, body.path, body.planted, body) },
          { role: 'user', content: eventMode
            ? String(body.message || '请从这件事之前的那些选择讲起。当时你最看重什么？得到了什么，又失去了什么？').slice(0, 400)
            : `接着用户刚说的往下聊，不要宣布换年份。用户说：${String(body.message || '').slice(0, 400)}${missing ? `。若还没问清，可以轻轻问到：${missing}` : ''}` },
        ])
        sendJson(response, 200, { ok: true, reply, action: eventMode ? 'event' : (missing === 'choice' && String(body.message || '').length < 8 ? 'probe' : 'ask') })
      } catch (error) {
        sendJson(response, error.statusCode || 503, { ok: false, error: error.code || 'MODEL_UNAVAILABLE' })
      }
      return true
    }
    if (request.method === 'POST' && url.pathname === '/api/life/synthesis') {
      const body = await readJsonBody(request)
      try {
        const reply = await chat([
          { role: 'system', content: synthesisPrompt(body) },
          { role: 'user', content: '请按指定 JSON 整理代价、成就、核心原因和前瞻方法论。' },
        ])
        const synthesis = parseSynthesis(reply)
        sendJson(response, 200, { ok: Boolean(synthesis), synthesis })
      } catch (error) {
        sendJson(response, error.statusCode || 503, { ok: false, error: error.code || 'MODEL_UNAVAILABLE' })
      }
      return true
    }
    if (request.method === 'POST' && url.pathname === '/api/life/report') {
      const body = await readJsonBody(request)
      const gate = authorizeReport(body.state, body.kind === 'partial' ? 'partial' : 'full')
      if (!gate.ok) {
        sendJson(response, gate.status, { ok: false, error: gate.error })
        return true
      }
      sendJson(response, 200, { ok: true, kind: body.kind === 'partial' ? 'partial' : 'full' })
      return true
    }
    return false
  } catch (error) {
    sendJson(response, error.statusCode || 500, { ok: false, error: error.code || 'ERROR' })
    return true
  }
}
