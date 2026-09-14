import { eraChoice, eraNodeForAge, flowerKindAt, type EraChoice, type EraNpc } from '../garden/gardenContent'
import type { ArchiveProfile } from '../archive/archiveInterview'
import type { PlantedChoice, RewindTarget } from '../garden/gardenState'
import { plainText, scoreSearchItem } from './mapPost'
import type { ZhihuSearchItem } from './types'

/** Only fields the player already typed or planted. Never infer a birth year. */
export type JourneyContext = {
  selectedAge: number
  currentAge: number | null
  /** Explicit calendar year from the archive answer, if the player said one. */
  calendarYear: number | null
  profile: Pick<ArchiveProfile, 'gender' | 'education' | 'health' | 'lifeEvent'>
  planted: Array<PlantedChoice & { label?: string }>
  /** Future OAuth: follow / favorite titles the player agreed to send. */
  playerTopics?: string[]
  /** Fourth-act interview slots. Only what the player said. */
  interview?: {
    nodes?: Array<{
      age?: number
      title?: string
      slots?: {
        choice?: string
        motive?: string
        constraint?: string
        alternative?: string
        agency?: string
      }
    }>
  }
}

export type MatchExplain = {
  /** One spoken sentence: why this person showed up. */
  headline: string
  /** Era backdrop + the choice they made then. Not a retrieval log. */
  story: string
  quote: string
}

export type DiscoveredChoice = {
  patternId: string
  label: string
  hits: number
  sampleTitle: string
}

export type ChoicePattern = {
  id: string
  label: string
  keywords: string[]
  minAge: number
  maxAge: number
  /** If set, node search will actively look for this fork when the skeleton omitted it. */
  probe?: boolean
}

/**
 * Life forks that authored nodes do not exhaust.
 * Hits come from Zhihu search titles/summaries, not from a hidden option list the player must invent.
 */
export const LIFE_CHOICE_PATTERNS: ChoicePattern[] = [
  { id: 'leftbehind', label: '留守，由祖辈或亲戚带大', keywords: ['留守', '爷爷奶奶', '外公外婆'], minAge: 0, maxAge: 12 },
  { id: 'single', label: '在单亲家庭里被带大', keywords: ['单亲', '一个人带大'], minAge: 0, maxAge: 16 },
  { id: 'adopt', label: '被收养 / 福利院', keywords: ['收养', '福利院', '孤儿'], minAge: 0, maxAge: 12 },
  { id: 'preterm', label: '早产，先在医院待很久', keywords: ['早产', '保温箱'], minAge: 0, maxAge: 6 },
  { id: 'wushu', label: '去武校', keywords: ['武校', '习武', '武术学校'], minAge: 4, maxAge: 16, probe: true },
  { id: 'sports-school', label: '去体校', keywords: ['体校', '体育学校', '去体校'], minAge: 10, maxAge: 18, probe: true },
  { id: 'medical-school', label: '去卫校', keywords: ['卫校', '医校', '医专', '卫生学校'], minAge: 14, maxAge: 20, probe: true },
  { id: 'army', label: '去当兵 / 入伍', keywords: ['当兵', '入伍', '参军', '军营', '服役'], minAge: 16, maxAge: 28 },
  { id: 'abroad', label: '出国留学 / 出境', keywords: ['出国', '留学', '海外', '交换生'], minAge: 16, maxAge: 40 },
  { id: 'startup', label: '创业 / 自己干', keywords: ['创业', '自己干', '开公司', '工作室'], minAge: 18, maxAge: 50 },
  { id: 'gap', label: '间隔年 / 先空一年', keywords: ['间隔年', 'gap year', '空一年', 'gap'], minAge: 16, maxAge: 30 },
  { id: 'transfer', label: '转专业 / 换方向', keywords: ['转专业', '换专业', '转系'], minAge: 18, maxAge: 26 },
  { id: 'dropout', label: '退学 / 离开校园', keywords: ['退学', '肄业', '离开学校'], minAge: 16, maxAge: 30 },
  { id: 'civil', label: '考公 / 事业编', keywords: ['考公', '公务员', '事业编', '体制内'], minAge: 20, maxAge: 40 },
  { id: 'graduate', label: '考研 / 读研', keywords: ['考研', '读研', '研究生', '二战'], minAge: 20, maxAge: 35 },
  { id: 'return-hometown', label: '回老家 / 离开一线', keywords: ['回老家', '返乡', '离开北上广'], minAge: 22, maxAge: 45 },
  { id: 'marry', label: '结婚 / 成家', keywords: ['结婚', '成家', '领证'], minAge: 22, maxAge: 45 },
  { id: 'child', label: '要不要孩子', keywords: ['要孩子', '生育', '生不生'], minAge: 25, maxAge: 45 },
  { id: 'layoff', label: '被裁后怎么走', keywords: ['被裁', '裁员', '优化'], minAge: 22, maxAge: 60 },
  { id: 'house', label: '买房 / 安一个住处', keywords: ['买房', '首付', '房贷'], minAge: 25, maxAge: 45 },
  { id: 'divorce', label: '离婚 / 分开过', keywords: ['离婚'], minAge: 25, maxAge: 55 },
  { id: 'second-child', label: '要不要二胎', keywords: ['二胎', '二孩'], minAge: 28, maxAge: 45 },
  { id: 'eldercare', label: '照料父母', keywords: ['照料父母', '伺候生病'], minAge: 35, maxAge: 70 },
  { id: 'early-retire', label: '提前退 / 内退', keywords: ['提前退休', '内退'], minAge: 45, maxAge: 60 },
  { id: 'widow', label: '丧偶之后怎么过', keywords: ['丧偶', '老伴走了'], minAge: 50, maxAge: 90 },
  { id: 'nursing', label: '去养老院 / 请护工', keywords: ['养老院', '护工'], minAge: 70, maxAge: 95 },
]

export function journeyContext(input: {
  selectedAge: number
  currentAge: number | null
  target?: RewindTarget | null
  profile?: ArchiveProfile
  planted?: PlantedChoice[]
  playerTopics?: string[]
  interview?: JourneyContext['interview']
}): JourneyContext {
  return {
    selectedAge: input.selectedAge,
    currentAge: input.currentAge,
    calendarYear: input.target?.year ?? null,
    profile: {
      gender: input.profile?.gender,
      education: input.profile?.education,
      health: input.profile?.health,
      lifeEvent: input.profile?.lifeEvent,
    },
    planted: (input.planted ?? []).map(item => ({
      ...item,
      label: item.label?.trim() || eraChoice(item.age, item.choiceId)?.label,
    })),
    playerTopics: (input.playerTopics ?? []).map(item => item.trim()).filter(Boolean).slice(0, 6),
    interview: input.interview,
  }
}

export function plantedLabel(item: JourneyContext['planted'][number]): string {
  return item.label || eraChoice(item.age, item.choiceId)?.label || item.choiceId
}

function profileGender(ctx: JourneyContext): string {
  const gender = ctx.profile.gender?.trim()
  return gender === '男' || gender === '女' ? gender : ''
}

function profileHealth(ctx: JourneyContext): string {
  const health = ctx.profile.health?.trim()
  if (!health || health === '不透露' || health.startsWith('不透露')) return ''
  return health
}

function compact(parts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    const text = plainText(part, 40)
    if (!text || seen.has(text)) continue
    seen.add(text)
    out.push(text)
  }
  return out
}

export function interviewHintTexts(interview?: JourneyContext['interview'] | null): string[] {
  return compact((interview?.nodes ?? []).flatMap(node => [
    node.title,
    node.slots?.choice,
    node.slots?.motive,
    node.slots?.constraint,
    node.slots?.alternative,
    node.slots?.agency,
  ]))
}

const HINT_SPLIT = /[，。；;、！!？?\s\/]+|(?:也想|也要|但是|可是|因为|所以|然后|或者|以及|不够)/

function clipHintChunk(raw: string): string[] {
  const text = plainText(raw, 40)
  if (!text) return []
  return compact(text.split(HINT_SPLIT).flatMap(part => {
    let chunk = part.trim()
    chunk = chunk.replace(/^(想|要|让|再搏|再去|再读)/, '')
    chunk = chunk.replace(/(一点|一些|一下)$/, '')
    if (chunk.length >= 2 && chunk.length <= 8) return [chunk]
    if (chunk.length > 8) {
      const known = LIFE_CHOICE_PATTERNS.flatMap(item => item.keywords).filter(word => chunk.includes(word))
      return known.length ? known : [chunk.slice(0, 6)]
    }
    return []
  }))
}

/** Short words for search. Agency stays out so we do not query 条件妥协 / 主动偏好. */
export function interviewQueryHints(interview?: JourneyContext['interview'] | null): string[] {
  return compact((interview?.nodes ?? []).flatMap(node => [
    node.slots?.alternative,
    node.slots?.motive,
    node.slots?.constraint,
    node.slots?.choice,
  ]).flatMap(slot => clipHintChunk(slot ?? '')))
    .filter(word => !/^(?:\d+年|一年|两年|三年)$/.test(word))
    .slice(0, 6)
}

export function journeyKeywords(ctx: JourneyContext): string[] {
  const last = ctx.planted.at(-1)
  return compact([
    ...ctx.planted.map(plantedLabel),
    ctx.profile.lifeEvent,
    ctx.selectedAge >= 16 ? ctx.profile.education : '',
    profileHealth(ctx),
    profileGender(ctx),
    ...(ctx.playerTopics ?? []),
    ...interviewHintTexts(ctx.interview),
    last ? `${last.age}岁` : '',
  ])
}

/** Next-three-years search: five archive answers + planted trail + interview slots. */
export function foresightQueries(ctx: JourneyContext, age: number): string[] {
  const last = ctx.planted.at(-1)
  const hints = interviewQueryHints(ctx.interview)
  return compact([
    compact([
      `${age}岁`,
      profileGender(ctx),
      age >= 16 ? ctx.profile.education : '',
      profileHealth(ctx),
    ]).join(' '),
    last ? `${age}岁 ${clipQuery(plantedLabel(last))} 之后` : `${age}岁 接下来`,
    ctx.profile.lifeEvent ? clipQuery(ctx.profile.lifeEvent) : '',
    hints[0] ? `${age}岁 ${clipQuery(hints[0])}` : '',
    hints[1] ? clipQuery(hints[1]) : '',
    hints[2] ? clipQuery(hints[2]) : '',
  ]).slice(0, 6)
}

/** Fourth-act candidate search: event first, then age + gender + education + health. */
export function candidateQueries(ctx: JourneyContext): string[] {
  const age = ctx.currentAge ?? ctx.selectedAge
  const last = ctx.planted.at(-1)
  const who = compact([
    age || age === 0 ? `${age}岁` : '',
    profileGender(ctx),
    age >= 16 ? ctx.profile.education : '',
    profileHealth(ctx),
  ]).join(' ')
  return compact([
    ctx.profile.lifeEvent,
    who,
    last ? `${plantedLabel(last)} ${profileGender(ctx)}`.trim() : '',
  ]).slice(0, 3)
}

function clipQuery(value: string): string {
  return plainText(value, 40)
}

/** 舞校算在艺校/艺考里，搜索里再单独长一朵就重复了。 */
const FORK_COVERED_BY: Record<string, string[]> = {
  舞校: ['艺校', '艺考'],
  舞蹈: ['艺校', '艺考'],
  跳舞: ['艺校', '艺考'],
}

function authoredCovers(label: string, authoredText: string): boolean {
  if (!label) return false
  if (authoredText.includes(label)) return true
  return (FORK_COVERED_BY[label] ?? []).some(parent => authoredText.includes(parent))
}

function labelTokens(label: string): string[] {
  return compact(label.split(/[/\s、，。()（）]+/).filter(word => word.length >= 2))
}

/** True when a live fork is already sitting on the node as an authored or discovered flower. */
export function choiceLabelOverlap(label: string, existing: string[]): boolean {
  const text = existing.join(' ')
  if (!label || authoredCovers(label, text)) return true
  const bits = labelTokens(label)
  return existing.some(other => {
    if (!other) return false
    if (other.includes(label) || label.includes(other)) return true
    return bits.some(bit => labelTokens(other).some(token => token.includes(bit) || bit.includes(token)))
  })
}

function discoveryProbes(ctx: JourneyContext): string[] {
  const authoredText = eraNodeForAge(ctx.selectedAge).choices.map(item => item.label).join(' ')
  return LIFE_CHOICE_PATTERNS
    .filter(pattern => pattern.probe)
    .filter(pattern => ctx.selectedAge >= pattern.minAge && ctx.selectedAge <= pattern.maxAge)
    .filter(pattern => !pattern.keywords.some(word => authoredCovers(word, authoredText) || authoredText.includes(word)))
    .map(pattern => `${ctx.selectedAge}岁 ${pattern.keywords[0]}`)
    .slice(0, 1)
}

function priorPlanted(ctx: JourneyContext, beforeAge = ctx.selectedAge) {
  return ctx.planted.filter(item => item.age < beforeAge)
}

/** Earliest ~0.75, latest ~2.0. One plant still counts as the recent end. */
export function recencyWeight(index: number, total: number): number {
  if (total <= 1) return 2
  return 0.75 + 1.25 * (index / (total - 1))
}

export function journeyDepth(ctx: JourneyContext): number {
  return Math.min(1, ctx.planted.length / 4)
}

/** How we search for a year's possible forks — age + era + the path already planted. */
export function nodeDiscoveryQueries(ctx: JourneyContext, authoredEvent: string): string[] {
  const age = ctx.selectedAge
  const prior = priorPlanted(ctx, age)
  const last = prior.at(-1)
  const prev = prior.at(-2)
  const lastLabel = last ? plantedLabel(last) : ''
  const event = clipQuery(authoredEvent) || '人生选择'
  const probe = discoveryProbes(ctx)[0] || ''
  return compact([
    lastLabel ? `${age}岁 ${clipQuery(lastLabel)} 之后 ${event}` : `${age}岁 ${event}`,
    ctx.profile.lifeEvent ? clipQuery(ctx.profile.lifeEvent) : '',
    age >= 16 && ctx.profile.education ? `${age}岁 ${clipQuery(ctx.profile.education)}` : '',
    profileGender(ctx) ? `${age}岁 ${profileGender(ctx)}` : '',
    profileHealth(ctx) ? `${age}岁 ${clipQuery(profileHealth(ctx))}` : '',
    ctx.calendarYear ? `${ctx.calendarYear}年 ${age}岁` : `${age}岁 选择 还是`,
    probe,
    prev ? `${age}岁 ${clipQuery(plantedLabel(prev))} ${clipQuery(lastLabel)}` : '',
    ctx.playerTopics?.[0] ? `${age}岁 ${clipQuery(ctx.playerTopics[0])}` : '',
  ]).slice(0, 6)
}

/** How we search for a person after the player plants a choice. Later plants push recent forks into the query. */
export function companionQueries(
  ctx: JourneyContext,
  choiceLabel: string,
  kind: 'same-era' | 'cross-era' | 'author',
  authorName = '',
): string[] {
  const age = ctx.selectedAge
  const choice = clipQuery(choiceLabel)
  const recent = priorPlanted(ctx, age).slice(-3).reverse()
  const recentLabels = recent.map(item => clipQuery(plantedLabel(item))).filter(Boolean)
  const hints = interviewQueryHints(ctx.interview)
  const hintQuery = hints.length ? `${age}岁 ${choice} ${hints.slice(0, 4).join(' ')}` : ''
  if (kind === 'author') return compact([authorQueryFor(authorName, choice || `${age}岁`)])
  if (kind === 'cross-era') {
    return compact([
      recentLabels[0] ? `${recentLabels[0]} 之后 ${choice} 后来怎样` : `${choice} 后来怎样`,
      `${choice} 值不值`,
      hintQuery,
      recentLabels[1] ? `${recentLabels[1]} ${choice}` : '',
    ]).slice(0, recentLabels.length >= 2 || hints.length ? 3 : 2)
  }
  const limit = recentLabels.length >= 2 || hints.length ? 3 : 2
  return compact([
    recentLabels[0] ? `${age}岁 ${recentLabels[0]} ${choice}` : '',
    hintQuery,
    ctx.calendarYear ? `${ctx.calendarYear}年 ${age}岁 ${choice}` : `${age}岁 ${choice} 经验`,
    recentLabels[1] ? `${recentLabels[1]} 之后 ${choice}` : `${age}岁 ${choice} 后来`,
    ctx.profile.lifeEvent ? `${age}岁 ${choice} ${clipQuery(ctx.profile.lifeEvent)}` : '',
    age >= 16 && ctx.profile.education ? `${age}岁 ${choice} ${clipQuery(ctx.profile.education)}` : '',
    profileGender(ctx) ? `${age}岁 ${choice} ${profileGender(ctx)}` : '',
    profileHealth(ctx) ? `${age}岁 ${choice} ${clipQuery(profileHealth(ctx))}` : '',
  ]).slice(0, limit)
}

export function authorQueryFor(author: string, hint: string): string {
  const name = author.trim()
  const extra = hint.trim()
  return extra ? `${name} ${extra}` : name
}

export function itemBlob(item: ZhihuSearchItem): string {
  return [item.Title, item.ContentText, item.Summary, item.Author?.Headline, item.AuthorBadgeText]
    .map(value => plainText(value, 400))
    .filter(Boolean)
    .join(' ')
}

const YOUNG_ADULT_FORK = /当兵|入伍|参军|大学|考研|实习|工作|结婚|买房|创业|考公|留学|退学|转专业|间隔年|继续读书/
const INFANT_SCHOOL_FORK = /读书|上学|小学|中学|高中|幼儿园/

export function choiceFitsSelectedAge(label: string, selectedAge: number): boolean {
  const hit = LIFE_CHOICE_PATTERNS.find(pattern =>
    pattern.keywords.some(word => label.includes(word)) || label.includes(pattern.label.split(' / ')[0]),
  )
  if (hit) return selectedAge >= hit.minAge && selectedAge <= hit.maxAge
  if (selectedAge < 12 && YOUNG_ADULT_FORK.test(label)) return false
  if (selectedAge < 5 && INFANT_SCHOOL_FORK.test(label)) return false
  return true
}

export function discoverTitleForks(items: ZhihuSearchItem[], authored: EraChoice[], selectedAge?: number): DiscoveredChoice[] {
  const authoredText = authored.map(item => `${item.id} ${item.label}`).join(' ')
  const found: DiscoveredChoice[] = []
  const seen = new Set<string>()
  const consider = (raw: string, item: ZhihuSearchItem) => {
    const clean = plainText(raw, 16).replace(/[？?！!，,。.\s]+$/g, '')
    if (clean.length < 2 || clean.length > 16 || authoredCovers(clean, authoredText) || seen.has(clean)) return
    if (selectedAge != null && !choiceFitsSelectedAge(clean, selectedAge)) return
    seen.add(clean)
    found.push({
      patternId: `live-${clean.replace(/\s+/g, '').slice(0, 12)}`,
      label: clean,
      hits: 1,
      sampleTitle: plainText(item.Title, 60) || clean,
    })
  }
  for (const item of items) {
    const title = plainText(item.Title, 80)
    for (const match of title.matchAll(/(?:我(?:选了|选择了|去了|决定)|选择了|决定去了?)([\u4e00-\u9fffA-Za-z0-9·]{2,14})/g)) {
      consider(match[1], item)
    }
    const pair = title.match(/([\u4e00-\u9fff]{2,8})还是([\u4e00-\u9fff]{2,8})/)
    if (pair) {
      consider(pair[1], item)
      consider(pair[2], item)
    }
  }
  return found.slice(0, 2)
}

export function discoverChoices(items: ZhihuSearchItem[], ctx: JourneyContext, authored: EraChoice[]): DiscoveredChoice[] {
  const authoredText = authored.map(item => `${item.id} ${item.label}`).join(' ')
  const found: DiscoveredChoice[] = []
  for (const pattern of LIFE_CHOICE_PATTERNS) {
    if (ctx.selectedAge < pattern.minAge || ctx.selectedAge > pattern.maxAge) continue
    if (pattern.keywords.some(word => authoredCovers(word, authoredText) || authoredText.includes(word))) continue
    const hits = items.filter(item => pattern.keywords.some(word => itemBlob(item).includes(word)))
    if (!hits.length) continue
    found.push({
      patternId: pattern.id,
      label: pattern.label,
      hits: hits.length,
      sampleTitle: plainText(hits[0]?.Title, 60) || pattern.label,
    })
  }
  const known = authored.map(item => item.label)
  for (const extra of discoverTitleForks(items, authored, ctx.selectedAge)) {
    const seen = [...known, ...found.map(item => item.label)]
    if (choiceLabelOverlap(extra.label, seen)) continue
    if (!choiceFitsSelectedAge(extra.label, ctx.selectedAge)) continue
    found.push(extra)
  }
  return found.filter(item => !choiceLabelOverlap(item.label, known)).sort((a, b) => b.hits - a.hits).slice(0, 3)
}

function pickSentence(text: string, needles: string[]): string {
  const clean = plainText(text, 600)
  const parts = clean.split(/(?<=[。！？!?；;])/).map(part => part.trim()).filter(part => part.length >= 8)
  const hit = parts.find(part => needles.some(word => word && part.includes(word)))
  return (hit || parts[0] || clean).slice(0, 72)
}

function overlapWords(blob: string, keywords: string[]): string[] {
  return keywords.filter(word => word.length >= 2 && blob.includes(word)).slice(0, 4)
}

export function authorAvatar(item: ZhihuSearchItem): string {
  const nested = item.Author?.Avatar || item.Author?.avatar || ''
  return String(item.AuthorAvatar || nested || '').trim()
}

function eraBackdrop(ctx: JourneyContext): string {
  return plainText(eraNodeForAge(ctx.selectedAge).era, 80)
}

function eraWhen(ctx: JourneyContext, item?: ZhihuSearchItem): string {
  if (ctx.calendarYear && item?.EditTime) {
    const published = new Date(item.EditTime * 1000).getFullYear()
    const delta = Math.abs(published - ctx.calendarYear)
    if (delta <= 3) return `${ctx.calendarYear} 年前后，大约 ${ctx.selectedAge} 岁。`
    return `${published} 年写下的经历，和 ${ctx.calendarYear} 年不是同一代空气，选择却同类。`
  }
  if (ctx.calendarYear) return `${ctx.calendarYear} 年前后。`
  return ''
}

function labelHits(blob: string, label: string): boolean {
  if (!label) return false
  if (blob.includes(label)) return true
  const bits = compact(label.split(/[/\s、，。()（）]+/).filter(word => word.length >= 2))
  return bits.some(word => blob.includes(word))
}

function whyMeet(hits: string[], ctx: JourneyContext, choiceLabel: string, author: string): string {
  const last = ctx.planted.at(-1)
  const lastName = last ? plantedLabel(last) : ''
  if (last && lastName !== choiceLabel && (hits.includes(lastName) || labelHits(hits.join(''), lastName))) {
    return `${author} 也从「${lastName}」走到了「${choiceLabel}」。`
  }
  if (labelHits(hits.join(' ') + choiceLabel, choiceLabel) && hits.some(word => choiceLabel.includes(word))) {
    return `同一年，${author} 也站在「${choiceLabel}」这一侧。`
  }
  if (ctx.profile.lifeEvent && hits.some(word => ctx.profile.lifeEvent!.includes(word) || word.includes(plainText(ctx.profile.lifeEvent, 8)))) {
    return `近况挨着：你写下「${plainText(ctx.profile.lifeEvent, 16)}」，${author} 也在过相近的日子。`
  }
  if (ctx.profile.education && hits.some(word => ctx.profile.education!.includes(word) || word.includes(plainText(ctx.profile.education, 8)))) {
    return `近况挨着：你写下「${plainText(ctx.profile.education, 16)}」，${author} 也在过相近的日子。`
  }
  if (profileHealth(ctx) && hits.some(word => profileHealth(ctx).includes(word) || word.includes(plainText(profileHealth(ctx), 8)))) {
    return `近况挨着：你写下「${plainText(profileHealth(ctx), 16)}」，${author} 也在过相近的日子。`
  }
  if (profileGender(ctx) && hits.includes(profileGender(ctx))) {
    return `同一年，${author} 也以相近的身份站在路口。`
  }
  if (hits.length) return `你们对上的是「${hits.slice(0, 2).join('、')}」。`
  return `同一年，${author} 也面对过「${choiceLabel}」。`
}

export function explainMatch(item: ZhihuSearchItem, ctx: JourneyContext, choiceLabel: string): MatchExplain {
  const blob = itemBlob(item)
  const choiceBits = compact(choiceLabel.split(/[/\s、]+/).filter(word => word.length >= 2))
  const keywords = compact([choiceLabel, ...choiceBits, ...journeyKeywords(ctx)])
  const hits = overlapWords(blob, keywords)
  const quote = pickSentence(String(item.ContentText || item.Summary || item.Title || ''), hits.length ? hits : keywords)
  const author = plainText(item.AuthorName || item.Author?.Name, 20) || '这位答主'
  const body = pickSentence(String(item.ContentText || item.Summary || ''), choiceBits.length ? choiceBits : keywords)
  const story = [eraWhen(ctx, item), eraBackdrop(ctx), body || `当时摆在面前的，是要不要走「${choiceLabel}」。`, `TA 选了「${choiceLabel}」。`]
    .filter(Boolean)
    .join('')
    .replace(/。{2,}/g, '。')
  return {
    headline: whyMeet(hits, ctx, choiceLabel, author),
    story,
    quote,
  }
}

export function journeyBoost(item: ZhihuSearchItem, ctx: JourneyContext, choiceLabel: string): number {
  const blob = itemBlob(item)
  const planted = ctx.planted
  let hitWeight = 0
  let maxWeight = 0
  planted.forEach((row, index) => {
    const weight = recencyWeight(index, planted.length)
    maxWeight += weight
    if (labelHits(blob, plantedLabel(row))) hitWeight += weight
  })
  const depth = journeyDepth(ctx)
  const sim = maxWeight ? hitWeight / maxWeight : 0
  const choiceHit = labelHits(blob, choiceLabel) ? 0.35 + 0.2 * depth : 0
  let era = 0
  if (ctx.calendarYear && item.EditTime) {
    const published = new Date(item.EditTime * 1000).getFullYear()
    const delta = Math.abs(published - ctx.calendarYear)
    era = delta <= 1 ? 0.18 : delta <= 3 ? 0.1 : 0
  }
  const eventHit = ctx.profile.lifeEvent && labelHits(blob, ctx.profile.lifeEvent) ? 0.12 : 0
  const healthHit = profileHealth(ctx) && labelHits(blob, profileHealth(ctx)) ? 0.08 : 0
  const genderHit = profileGender(ctx) && blob.includes(profileGender(ctx)) ? 0.05 : 0
  const interviewHit = interviewQueryHints(ctx.interview).some(hint => labelHits(blob, hint)) ? 0.14 : 0
  return sim * (1.2 + 2.2 * depth) + choiceHit + era + eventHit + healthHit + genderHit + interviewHit
}

export function portraitScore(item: ZhihuSearchItem, ctx: JourneyContext, choiceLabel: string): number {
  const share = 0.22 + 0.53 * journeyDepth(ctx)
  return (1 - share) * scoreSearchItem(item) + share * journeyBoost(item, ctx, choiceLabel)
}

export function rankSearchItems(items: ZhihuSearchItem[], ctx: JourneyContext, choiceLabel: string, limit = 4): ZhihuSearchItem[] {
  const ranked = (choiceLabel.trim()
    ? items.filter(item => labelHits(itemBlob(item), choiceLabel))
    : items
  ).sort((a, b) => portraitScore(b, ctx, choiceLabel) - portraitScore(a, ctx, choiceLabel))
  return ranked.slice(0, limit)
}

function itemAuthor(item: ZhihuSearchItem): string {
  return plainText(item.AuthorName || item.Author?.Name, 24)
}

function itemKey(item: ZhihuSearchItem): string {
  return String(item.Url || '').trim() || `${itemAuthor(item)}:${plainText(item.Title, 40)}`
}

function titleShingles(title: string): string[] {
  const clean = plainText(title, 40).replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, '')
  const out: string[] = []
  for (let i = 0; i < clean.length - 1; i++) out.push(clean.slice(i, i + 2))
  return out
}

function sameLandingStory(left: ZhihuSearchItem, right: ZhihuSearchItem): boolean {
  const source = titleShingles(String(left.Title || ''))
  if (source.length < 4) return false
  const other = new Set(titleShingles(String(right.Title || '')))
  const hits = source.filter(part => other.has(part)).length
  return hits / source.length >= 0.4
}

function laterLookback(item: ZhihuSearchItem): boolean {
  return /后来|值不值|回头|十年/.test(itemBlob(item))
}

export function selectCompanionPortraits(
  sameItems: ZhihuSearchItem[],
  crossItems: ZhihuSearchItem[],
  ctx: JourneyContext,
  choiceLabel: string,
): { similar?: ZhihuSearchItem, peer?: ZhihuSearchItem, far?: ZhihuSearchItem } {
  const same = rankSearchItems(sameItems, ctx, choiceLabel, 8)
  const similar = same[0]
  const peer = similar
    ? same.find(item => itemKey(item) !== itemKey(similar) && itemAuthor(item) !== itemAuthor(similar) && !sameLandingStory(similar, item))
    : undefined
  const taken = new Set([similar, peer].filter((item): item is ZhihuSearchItem => Boolean(item)).map(itemKey))
  const takenAuthors = new Set([similar, peer].filter((item): item is ZhihuSearchItem => Boolean(item)).map(itemAuthor).filter(Boolean))
  const cross = rankSearchItems(crossItems, ctx, choiceLabel, 8)
    .filter(item => !taken.has(itemKey(item)) && !takenAuthors.has(itemAuthor(item)))
  const far = cross.find(laterLookback) ?? cross[0]
  return { similar, peer, far }
}

export function npcFromSearch(item: ZhihuSearchItem, ctx: JourneyContext, choiceLabel: string, fallback: EraNpc): EraNpc {
  const explain = explainMatch(item, ctx, choiceLabel)
  const body = plainText(item.ContentText || item.Summary, 280)
  const sentences = body.split(/(?<=[。！？!?])/).map(part => part.trim()).filter(Boolean)
  return {
    name: plainText(item.AuthorName || item.Author?.Name, 24) || fallback.name,
    identity: plainText(item.AuthorBadgeText || item.Author?.Headline, 40) || fallback.identity,
    proposition: sentences[0] || fallback.proposition,
    match: explain.headline,
    avatar: authorAvatar(item) || fallback.avatar,
    causal: {
      background: explain.story,
      options: fallback.causal.options,
      choice: choiceLabel,
      cost: sentences[1] || fallback.causal.cost,
      reflection: explain.quote || fallback.causal.reflection,
    },
  }
}

export function eraChoiceFromDiscovery(
  discovery: DiscoveredChoice,
  items: ZhihuSearchItem[],
  ctx: JourneyContext,
  index: number,
): EraChoice {
  const pattern = LIFE_CHOICE_PATTERNS.find(item => item.id === discovery.patternId)
  const sample = items.find(item => (pattern?.keywords ?? []).some(word => itemBlob(item).includes(word)))
  const explain = sample ? explainMatch(sample, ctx, discovery.label) : null
  const optionLine = discovery.label
  return {
    id: discovery.patternId,
    label: discovery.label,
    peer: 0,
    reason: sample
      ? `这个年纪也有人走「${discovery.label}」。比如《${discovery.sampleTitle}》。`
      : `这个年纪也出现了「${discovery.label}」。`,
    flowerKind: flowerKindAt(3 + index),
    npc: {
      name: plainText(sample?.AuthorName || sample?.Author?.Name, 24) || '走过这条路的人',
      identity: plainText(sample?.AuthorBadgeText || sample?.Author?.Headline, 40) || '走过这条分岔的人',
      proposition: explain?.quote || discovery.sampleTitle,
      match: explain?.headline || `同一年，也有人站在「${discovery.label}」这一侧。`,
      avatar: sample ? authorAvatar(sample) : undefined,
      causal: {
        background: explain?.story || `${eraWhen(ctx)} ${eraBackdrop(ctx)} 当时出现了「${discovery.label}」。`,
        options: optionLine,
        choice: discovery.label,
        cost: '有人走过，不证明你也必须走。',
        reflection: explain?.quote || '先看原文，再决定要不要把这条路种下。',
      },
    },
  }
}

export function mergeDiscoveredChoices(authored: EraChoice[], discovered: EraChoice[]): EraChoice[] {
  const used = new Set(authored.map(item => item.id))
  const labels = authored.map(item => item.label)
  const extra = discovered.filter(item => {
    if (used.has(item.id) || choiceLabelOverlap(item.label, labels)) return false
    used.add(item.id)
    labels.push(item.label)
    return true
  })
  return [...authored, ...extra].slice(0, 9)
}

export function fallbackNodeQueries(age: number, choiceId: string): string[] {
  const node = eraNodeForAge(age)
  const choice = eraChoice(age, choiceId) ?? node.choices[0]
  const primary = `${node.age}岁 ${choice.label}`
  const event = `${node.event} ${choice.label}`
  return primary === event ? [primary] : [primary, event]
}

/** Offline / demo: still name concrete overlaps, never a fake matching score. */
export function explainAuthored(choice: EraChoice, ctx: JourneyContext): MatchExplain {
  const last = ctx.planted.at(-1)
  const author = choice.npc.name
  const lastName = last ? plantedLabel(last) : ''
  const headline = last && lastName && lastName !== choice.label
    ? `${author} 也从「${lastName}」走到了「${choice.label}」。`
    : `同一年，${author} 也站在「${choice.label}」这一侧。`
  const causal = choice.npc.causal
  const story = [
    eraWhen(ctx),
    eraBackdrop(ctx),
    ctx.profile.lifeEvent ? `你写下「${plainText(ctx.profile.lifeEvent, 16)}」。` : '',
    causal.background,
    `TA 选了「${causal.choice || choice.label}」。`,
  ].join('').replace(/。{2,}/g, '。')
  const quote = causal.reflection || choice.npc.proposition
  return { headline, story, quote }
}
