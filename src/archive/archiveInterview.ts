export const ARCHIVE_PROFILE_KEYS = ['age', 'gender', 'education', 'health', 'lifeEvent'] as const

export type ArchiveQuestionId = typeof ARCHIVE_PROFILE_KEYS[number]

export type ArchiveProfile = Partial<Record<ArchiveQuestionId, string>> & {
  lifeEvents?: LifeEventEntry[]
}

export const LIFE_EVENT_LIMIT = 5

export type LifeEventEntry = { age: number; text: string }

export type ArchiveQuestion = {
  id: ArchiveQuestionId
  progress: number
  checkpoint: string
  prompt: string
  note: string
  placeholder: string
  inputMode: 'numeric' | 'text'
  options?: string[]
}

export const GENDER_OPTIONS = ['男', '女'] as const
export const EDUCATION_OPTIONS = ['高中及以下', '专科', '本科', '硕士', '博士', '其他'] as const
export const HEALTH_OPTIONS = ['上学', '工作', '空档过渡', '照顾家庭', '不透露'] as const
const LEGACY_HEALTH_OPTIONS = ['良好', '一般', '慢性病或长期不适'] as const

const STAGE_WORDS = ['毕业', '高考', '大学', '考研', '入伍', '当兵', '开学', '留学', '创业']

export const ARCHIVE_QUESTIONS: ArchiveQuestion[] = [
  {
    id: 'age',
    progress: 0.14,
    checkpoint: '左侧 · 第一盏灯',
    prompt: '先告诉我，你现在几岁？',
    note: '这会决定回测从哪一段人生开始比对。',
    placeholder: '输入你的年龄，例如：24',
    inputMode: 'numeric',
  },
  {
    id: 'gender',
    progress: 0.3,
    checkpoint: '右侧 · 第二盏灯',
    prompt: '你如何描述自己的性别？',
    note: '请选择男或女。',
    placeholder: '男 / 女',
    inputMode: 'text',
    options: [...GENDER_OPTIONS],
  },
  {
    id: 'education',
    progress: 0.47,
    checkpoint: '左侧 · 第二盏灯',
    prompt: '你目前的学历是什么？',
    note: '选「其他」时请补一句具体说明。',
    placeholder: '高中及以下 / 专科 / 本科 / 硕士 / 博士 / 其他',
    inputMode: 'text',
    options: [...EDUCATION_OPTIONS],
  },
  {
    id: 'health',
    progress: 0.7,
    checkpoint: '右侧 · 第四盏灯',
    prompt: '你现在的生活状况怎样？',
    note: '可以只点选项，也可以再补一句。',
    placeholder: '上学 / 工作 / 空档过渡 / 照顾家庭 / 不透露',
    inputMode: 'text',
    options: [...HEALTH_OPTIONS],
  },
  {
    id: 'lifeEvent',
    progress: 1,
    checkpoint: '审查席 · 最后一问',
    prompt: '对你影响最大的人生事件是什么？',
    note: '先写最重要的一件。还可以再记最多四个时间点上的重大选择。',
    placeholder: '例如：18岁高考选了省内',
    inputMode: 'text',
  },
]

const EPSILON = 0.0001

export function nextArchiveQuestion(
  fromProgress: number,
  toProgress: number,
  profile: Readonly<ArchiveProfile>,
) {
  return ARCHIVE_QUESTIONS.find((question) => (
    !profile[question.id]
    && question.progress > fromProgress + EPSILON
    && question.progress <= toProgress + EPSILON
  ))
}

export function previousArchiveQuestion(id: ArchiveQuestionId) {
  const index = ARCHIVE_QUESTIONS.findIndex((question) => question.id === id)
  return index > 0 ? ARCHIVE_QUESTIONS[index - 1] : undefined
}

export function lifeEventFollowUp(value: string): 'age' | 'stage' | 'year' | 'need-age' {
  const raw = value.trim()
  if (!raw) return 'need-age'
  if (/\d{1,3}\s*(?:周)?岁/.test(raw)) return 'age'
  if (/(?:19|20)\d{2}\s*年/.test(raw)) return 'year'
  if (STAGE_WORDS.some(word => raw.includes(word))) return 'stage'
  return 'need-age'
}

export function normalizeArchiveAnswer(question: ArchiveQuestion, value: string) {
  const answer = value.trim().replace(/\s+/g, ' ')
  if (question.id !== 'age') return answer
  const age = Number.parseInt(answer, 10)
  return Number.isFinite(age) ? String(age) : ''
}

function matchesOption(answer: string, options: readonly string[]) {
  return options.some(option => answer === option || answer.startsWith(`${option} `) || answer.startsWith(`${option}：`) || answer.startsWith(`${option}:`))
}

export function archiveAnswerError(question: ArchiveQuestion, value: string) {
  const answer = normalizeArchiveAnswer(question, value)
  if (!answer) return '请留下一个回答，档案才能继续。'
  if (question.id === 'age') {
    const age = Number(answer)
    if (age < 10 || age > 100) return '请输入 10 到 100 之间的年龄。'
  }
  if (question.id === 'gender' && !GENDER_OPTIONS.includes(answer as typeof GENDER_OPTIONS[number])) {
    return '请选择男或女。'
  }
  if (question.id === 'education') {
    if (answer === '其他') return '选其他时，请补一句具体说明。'
    if (!matchesOption(answer, EDUCATION_OPTIONS)) return '请选择一个学历，或从「其他」写起。'
  }
  if (question.id === 'health' && !matchesOption(answer, HEALTH_OPTIONS) && !matchesOption(answer, LEGACY_HEALTH_OPTIONS)) {
    return '请选择一项生活状况。'
  }
  if (question.id === 'lifeEvent' && lifeEventFollowUp(answer) === 'need-age') {
    return '请补上这件事发生时你几岁，例如：18岁换了工作。'
  }
  if (answer.length > 80) return '回答可以更短一些，保留最重要的信息即可。'
  return ''
}

function eventAge(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value <= 100 ? value : null
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(\d{1,3})(?:\s*岁)?$/)
  if (!match) return null
  const age = Number.parseInt(match[1], 10)
  return Number.isInteger(age) && age >= 0 && age <= 100 ? age : null
}

function ageFromEventText(value: string): number | null {
  const match = value.match(/(\d{1,3})\s*(?:周)?岁/)
  return match ? eventAge(match[1]) : null
}

export function readLifeEventEntries(value: unknown): LifeEventEntry[] {
  if (!Array.isArray(value)) return []
  const byAge = new Map<number, LifeEventEntry>()
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as { age?: unknown; text?: unknown }
    const text = typeof raw.text === 'string' ? raw.text.trim().slice(0, 80) : ''
    const age = eventAge(raw.age) ?? ageFromEventText(text)
    if (age === null || !text) continue
    byAge.set(age, { age, text })
  }
  return [...byAge.values()].sort((a, b) => a.age - b.age)
}

export function readLifeEvents(profile: Pick<ArchiveProfile, 'lifeEvent' | 'lifeEvents'>, confirmedAge: number | null = null): LifeEventEntry[] {
  const extras = readLifeEventEntries(profile.lifeEvents)
  const raw = profile.lifeEvent?.trim() ?? ''
  const firstAge = ageFromEventText(raw) ?? confirmedAge
  const first = raw && firstAge !== null ? [{ age: firstAge, text: raw.slice(0, 80) }] : []
  const byAge = new Map<number, LifeEventEntry>()
  for (const item of [...first, ...extras]) byAge.set(item.age, item)
  return [...byAge.values()].sort((a, b) => a.age - b.age).slice(0, LIFE_EVENT_LIMIT)
}

export function addLifeEvent(events: LifeEventEntry[], entry: LifeEventEntry): LifeEventEntry[] {
  if (events.some(item => item.age === entry.age)) {
    return readLifeEventEntries(events.map(item => item.age === entry.age ? entry : item))
  }
  if (events.length >= LIFE_EVENT_LIMIT) return events
  return readLifeEventEntries([...events, entry])
}

export function extraLifeEventError(ageRaw: string, text: string, currentAge: number | null): string {
  const age = eventAge(ageRaw)
  const written = text.trim()
  if (age === null) return '请写下这件事发生时你几岁。'
  if (currentAge !== null && age > currentAge) return '这件事不能晚于你现在的年龄。'
  if (!written) return '请写下那一年的重大选择。'
  if (written.length > 80) return '回答可以更短一些，保留最重要的信息即可。'
  return ''
}
