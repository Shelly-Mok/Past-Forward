import './accessOverlay.css'

type AccessCatalog = {
  ok: boolean
  generatedAt?: string
  identity?: string
  note?: string
  auth?: { ok?: boolean, verification?: string, source?: string, masked?: string }
  capabilities?: Record<string, { available?: boolean, dailyLimit?: number, note?: string, error?: string | null }>
  me?: {
    contents?: { totals?: number, samples?: Array<{ title: string, url: string, summary: string }>, error?: string | null }
    followees?: { totals?: number, samples?: Array<{ name: string, headline: string, url: string }>, error?: string | null }
    favoriteLists?: { items?: Array<{ title: string, url: string, public: boolean }>, error?: string | null }
    recentFavorites?: { samples?: Array<{ title: string, url: string, summary: string, author: string }>, error?: string | null }
    favoriteSample?: { list?: string | null, samples?: Array<{ title: string, url: string }>, error?: string | null }
    knowledge?: { items?: Array<{ name: string, count: number, visibility: string }>, error?: string | null }
  }
  public?: {
    searchQuery?: string
    searchSamples?: Array<{ title: string, url: string, author: string, summary: string }>
    hotSamples?: Array<{ title: string, url: string, summary: string }>
  }
  detail?: string
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

function linkList(items: Array<{ title?: string, name?: string, url?: string, summary?: string, headline?: string, author?: string }> = []) {
  const list = el('ul', 'zhihu-access-list')
  if (!items.length) {
    list.append(el('li', 'is-empty', '这一项目前是空的。'))
    return list
  }
  for (const item of items) {
    const row = el('li')
    const title = item.title || item.name || '未命名'
    if (item.url) {
      const link = el('a', '', title)
      link.href = item.url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      row.append(link)
    } else {
      row.append(el('strong', '', title))
    }
    const meta = item.author || item.headline || item.summary
    if (meta) row.append(el('p', '', meta))
    list.append(row)
  }
  return list
}

function section(title: string, body: HTMLElement, note?: string | null) {
  const wrap = el('section', 'zhihu-access-section')
  wrap.append(el('h2', '', title))
  if (note) wrap.append(el('p', 'zhihu-access-note', note))
  wrap.append(body)
  return wrap
}

export function mountAccessOverlay(host: HTMLElement) {
  const root = el('aside', 'zhihu-access')
  root.setAttribute('aria-label', '可访问的知乎信息')
  const inner = el('div', 'zhihu-access-inner')
  inner.append(el('p', 'zhihu-access-kicker', '知乎开放平台'))
  inner.append(el('h1', '', '当前账号能访问的信息'))
  inner.append(el('p', 'zhihu-access-lead', '正在读取 Access Secret 所属账号的公开范围数据，以及一条搜索 / 热榜探针。密钥不会出现在这一页。'))
  const status = el('p', 'zhihu-access-status', '正在探测接口…')
  const body = el('div', 'zhihu-access-body')
  const actions = el('div', 'zhihu-access-actions')
  const play = el('a', '', '进入人生回测')
  play.href = '/?debug=garden'
  const close = el('button', '', '先看这一页')
  close.type = 'button'
  close.addEventListener('click', () => root.classList.add('is-reading'))
  actions.append(play, close)
  inner.append(status, body, actions)
  root.append(inner)
  host.append(root)

  fetch('/api/zhihu/access')
    .then(async response => {
      const catalog = await response.json() as AccessCatalog
      if (!response.ok) throw new Error(catalog.detail || '接口读取失败')
      return catalog
    })
    .then(catalog => {
      status.textContent = catalog.auth?.verification === 'valid'
        ? `鉴权有效 · ${catalog.identity === 'access_secret_owner' ? 'Access Secret 所属账号' : '已连接'} · ${catalog.generatedAt?.slice(0, 16) || ''}`
        : `鉴权异常 · ${catalog.auth && 'ok' in catalog.auth && catalog.auth.ok === false ? '未通过校验' : '请检查钥匙串'}`
      body.replaceChildren()
      if (catalog.note) body.append(el('p', 'zhihu-access-note', catalog.note))

      const caps = el('ul', 'zhihu-access-caps')
      for (const [name, item] of Object.entries(catalog.capabilities || {})) {
        const row = el('li', item.available ? 'is-on' : 'is-off')
        row.append(el('strong', '', name))
        row.append(el('span', '', [
          item.available ? '可用' : '未接通',
          item.dailyLimit ? `${item.dailyLimit}/天` : '',
          item.note || item.error || '',
        ].filter(Boolean).join(' · ')))
        caps.append(row)
      }
      body.append(section('能力清单', caps))

      const me = catalog.me
      body.append(section(
        `我的创作 · ${me?.contents?.totals ?? 0} 条`,
        linkList(me?.contents?.samples),
        me?.contents?.error,
      ))
      body.append(section(
        `我的关注 · ${me?.followees?.totals ?? 0} 人`,
        linkList(me?.followees?.samples),
        me?.followees?.error,
      ))
      body.append(section(
        '收藏夹',
        linkList((me?.favoriteLists?.items || []).map(item => ({
          title: `${item.title}${item.public ? '' : ' · 私密'}`,
          url: item.url,
        }))),
        me?.favoriteLists?.error,
      ))
      body.append(section('近期收藏', linkList(me?.recentFavorites?.samples), me?.recentFavorites?.error))
      if (me?.favoriteSample?.list) {
        body.append(section(`收藏夹抽样 · ${me.favoriteSample.list}`, linkList(me.favoriteSample.samples), me.favoriteSample.error))
      }
      body.append(section(
        '知识库',
        linkList((me?.knowledge?.items || []).map(item => ({
          title: item.name,
          summary: `${item.count} 条 · ${item.visibility}`,
        }))),
        me?.knowledge?.error,
      ))
      body.append(section(
        `搜索探针 · ${catalog.public?.searchQuery || ''}`,
        linkList(catalog.public?.searchSamples),
      ))
      body.append(section('热榜探针', linkList(catalog.public?.hotSamples)))
    })
    .catch(async error => {
      const reason = error instanceof Error ? error.message : '未知错误'
      try {
        const health = await fetch('/api/health').then(response => response.json()) as {
          zhihu?: { cli?: boolean, authConfigured?: boolean, next?: string }
        }
        if (!health.zhihu?.cli) {
          status.textContent = `还没有找到本仓库的 zhihu-cli。在 Past-Forward 目录运行 pnpm zhihu:setup。本地演示内容仍可继续玩。`
          return
        }
        if (!health.zhihu.authConfigured) {
          status.textContent = `CLI 已就绪，但本机还没有 Access Secret。打开 https://developer.zhihu.com/profile 生成后运行 pnpm zhihu:auth。本地演示内容仍可继续玩。`
          return
        }
      } catch {
        /* fall through to generic error */
      }
      status.textContent = `读取失败：${reason}。本地演示内容仍可继续玩。`
    })

  return root
}
