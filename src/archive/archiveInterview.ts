export type ArchiveQuestionId = 'age' | 'gender' | 'family' | 'status' | 'rewind'

export type ArchiveProfile = Partial<Record<ArchiveQuestionId, string>>

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
    note: '按你愿意被理解的方式回答，也可以选择不透露。',
    placeholder: '男 / 女 / 非二元 / 其他',
    inputMode: 'text',
    options: ['男', '女', '非二元', '不透露'],
  },
  {
    id: 'family',
    progress: 0.47,
    checkpoint: '左侧 · 第二盏灯',
    prompt: '你现在的家庭情况是什么样？',
    note: '只需写会影响这次选择的关系与责任。',
    placeholder: '例如：单身，与父母同住 / 已婚，有一个孩子',
    inputMode: 'text',
  },
  {
    id: 'status',
    progress: 0.7,
    checkpoint: '右侧 · 第四盏灯',
    prompt: '你现在处于怎样的学习或就业状态？',
    note: '这会帮助档案局判断你的现实起点。',
    placeholder: '上班 / 学生 / 自由职业 / 创业 / 待业 / 其他',
    inputMode: 'text',
    options: ['上班', '学生', '自由职业', '创业', '待业'],
  },
  {
    id: 'rewind',
    progress: 1,
    checkpoint: '审查席 · 最后一问',
    prompt: '你想回到哪一年，或人生的哪个阶段？',
    note: '不必精确。一个年龄、一年，或“毕业前”都可以。',
    placeholder: '例如：18 岁 / 2020 年 / 大学毕业前',
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

export function normalizeArchiveAnswer(question: ArchiveQuestion, value: string) {
  const answer = value.trim().replace(/\s+/g, ' ')
  if (question.id !== 'age') return answer
  const age = Number.parseInt(answer, 10)
  return Number.isFinite(age) ? String(age) : ''
}

export function archiveAnswerError(question: ArchiveQuestion, value: string) {
  const answer = normalizeArchiveAnswer(question, value)
  if (!answer) return '请留下一个回答，档案才能继续。'
  if (question.id === 'age') {
    const age = Number(answer)
    if (age < 10 || age > 100) return '请输入 10 到 100 之间的年龄。'
  }
  if (answer.length > 80) return '回答可以更短一些，保留最重要的信息即可。'
  return ''
}
