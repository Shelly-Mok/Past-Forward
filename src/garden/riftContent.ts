import { eraChoice, eraNodeForAge, ownChoice, type EraNpc } from './gardenContent'

export type RiftKind = 'backtrack' | 'forward' | 'foresight' | 'end'

export type RiftHole = {
  id: RiftKind
  label: string
  kicker: string
  hint: string
  x: number
  y: number
}

export const RIFT_HOLES: RiftHole[] = [
  { id: 'backtrack', label: '回溯', kicker: '第四幕 · 平行宇宙', hint: '重访改造的那条路', x: 24.2, y: 41.5 },
  { id: 'foresight', label: '前瞻', kicker: '第五幕 · 尚未发生的年', hint: '看现年后三年的可能', x: 50.0, y: 32.4 },
  { id: 'end', label: '结束', kicker: '第六幕 · 带着领悟离开', hint: '把选择停在这一刻', x: 75.8, y: 41.0 },
]

export const CROSSROADS_VOYAGE = {
  kicker: '◇ 启航 · 前往三岔口',
  title: '一个新的节点正在形成',
  lead: '过去已经写下。',
  body: '从这里开始，没有人知道答案。',
  action: '前往三岔口 →',
}

export function holeById(id: RiftKind) {
  return RIFT_HOLES.find(item => item.id === id)
}

export type FollowScene = { title: string; lead: string; beats: string[] }
export type Age28Option = { id: string; label: string; peer: number; later: string }
export type ForesightBranch = {
  id: string
  label: string
  event: string
  later: string
  premise: string
  chance: [number, number]
  boosts?: Record<string, number>
}
export type ForesightYear = {
  age: number
  hub: string
  eraExtra: string
  merge: string
  branches: ForesightBranch[]
}

export const FOLLOW_SCENES: Record<string, FollowScene> = {
  second: {
    title: '沿着 TA 的路：再搏一年之后',
    lead: '你跟着这位平行宇宙管理员，把当时的选择又往前走了一年。',
    beats: [
      '这一年没有观众。大部分时间是重复、自我怀疑，和偶尔的清醒。',
      '结果出来时，TA 没有把它写成命运，只写成：问题修了，就值得；没修，就重复。',
      '你看见的不是「上岸剧本」，是一个人愿意为最坏结果负责。',
    ],
  },
  job: {
    title: '沿着 TA 的路：先去工作之后',
    lead: '你跟着这位平行宇宙管理员，走进了办公室、车间或店铺。',
    beats: [
      '没有逆袭，也没有崩盘。工资普通，周末开始属于自己。',
      'TA 花了很久才不再用「考上」衡量每一天。',
      '你看见的是：承认尽力之后，生活仍可以继续。',
    ],
  },
  exam: {
    title: '沿着 TA 的路：转向求稳之后',
    lead: '你跟着这位平行宇宙管理员，把目标从名校改成了生活。',
    beats: [
      '备考很枯燥，但节奏是可控的。',
      'TA 不再解释自己为什么不够传奇。',
      '你看见的是：改口之后，晚上可以回家。',
    ],
  },
  factory: {
    title: '沿着 TA 的路：大厂三年后',
    lead: '你跟着这位平行宇宙管理员，走进了高强度的放大器。',
    beats: [
      '薪资先到来，方向感后丢失。',
      'TA 开始问：我是在变强，还是只是更快。',
      '你看见的是：放大器不会替你选择终点。',
    ],
  },
  gov: {
    title: '沿着 TA 的路：上岸之后',
    lead: '你跟着这位平行宇宙管理员，走进了被叫做「一眼望到头」的日子。',
    beats: [
      '工作并不神圣，但晚上是自己的。',
      'TA 用余力去生活，而不是继续证明自己。',
      '你看见的是：稳定也可以是主动选择。',
    ],
  },
  master: {
    title: '沿着 TA 的路：读研之后',
    lead: '你跟着这位平行宇宙管理员，把选择又推迟了几年。',
    beats: [
      '教室很安静，问题还在。',
      'TA 终于承认：缓冲不是方向。',
      '你看见的是：延期很贵，除非你真的知道为什么。',
    ],
  },
  switch30: {
    title: '沿着 TA 的路：验证后再下水',
    lead: '你跟着这位平行宇宙管理员，把转行做成了一次最小验证。',
    beats: [
      '业余时间先做出能被付费的作品，而不是用裸辞逼自己成长。',
      '收入会先归零。年龄劣势和学习曲线同时到来。',
      '你看见的是：来得及的定义权，不在招聘表的年龄栏。',
    ],
  },
}

const FOLLOW_KEYS: Record<string, string> = {
  major: 'job', intern: 'job', pause: 'second',
  second: 'second', job: 'job', exam: 'exam',
  college: 'master', work18: 'job', repeat: 'second',
  switch30: 'switch30', deep: 'job', freelance: 'job',
  sprint: 'factory', settle: 'exam', care: 'exam',
  hold: 'job', turn: 'switch30', teach: 'job',
}

export function followKeyForChoice(choiceId?: string | null): string {
  return (choiceId && FOLLOW_KEYS[choiceId]) || 'job'
}

export function followSceneForChoice(choiceId?: string | null): FollowScene {
  return FOLLOW_SCENES[followKeyForChoice(choiceId)] ?? FOLLOW_SCENES.job
}

export const AGE_28 = {
  age: 28,
  event: '职业转型',
  confusion: '你最纠结的是「年龄与试错成本」：转行怕来不及，深耕怕不甘心，自由职业怕没有兜底。',
  scenario: '二十八岁这一年，转型不再是别人的中年危机。你开始认真问：是重新开始、把原有领域走深，还是把「想自由」变成「敢自由」。',
  options: [
    { id: 'switch28', label: '转行', peer: 29, later: '先验证再下水。收入会归零，但来得及的定义权不在招聘表上。' },
    { id: 'deep', label: '继续深耕', peer: 48, later: '多数人把深度当护城河。不甘心还在，试错成本已经看得见。' },
    { id: 'freelance', label: '自由职业', peer: 23, later: '自由看起来轻，账单不轻。前提往往是自律，和一笔够用的试错存款。' },
  ] satisfies Age28Option[],
}

export const FORESIGHT_YEARS: ForesightYear[] = [
  {
    age: 25,
    hub: '惯性还是改口',
    eraExtra: '二十五岁这一年，同龄人开始用「留下来」和「回去」衡量彼此，很少再问理想。',
    merge: '三条事件抉择在 26 岁再次交汇——前瞻不是单线命运。',
    branches: [
      {
        id: 'stay-city', label: '留下一线', event: '留下还是离开这座城',
        premise: '你还能承受一线的租金与比较，且没把「留下」写成胜利。',
        later: '一线没有把人变成谁，只是让人更会熬。留下本身不是胜利，留下之后还能长出生活才是。',
        chance: [0.26, 0.36], boosts: { intern: 0.06, job: 0.06, sprint: 0.05 },
      },
      {
        id: 'go-home', label: '回到家乡 / 求稳', event: '用稳定换叙事',
        premise: '确定性对你已经比叙事更值钱，晚上十一点前结束一天是刚需。',
        later: '同学会以为这是认输。其实只是换了一套计价方式：失去被羡慕的叙事，得到晚饭和可预期的晚上。',
        chance: [0.18, 0.30], boosts: { exam: 0.1, settle: 0.08 },
      },
      {
        id: 'one-more-year', label: '再给自己一年', event: '要不要再押一年',
        premise: '上一轮失败原因可修复，并且你能把最坏结果先摊在桌上。',
        later: '这一年没有观众。值不值不取决于决心，取决于问题修了没有；没修，就只是把错误重复一遍。',
        chance: [0.14, 0.26], boosts: { second: 0.12, pause: 0.08, repeat: 0.08 },
      },
    ],
  },
  {
    age: 26,
    hub: '尺子还在别人手里吗',
    eraExtra: '二十六岁，更好的机会开始带着更贵的代价上门。会不会拒绝，变成一种新能力。',
    merge: '无论 25 岁怎么选，26 岁都会再问一次：你用什么当尺子。',
    branches: [
      {
        id: 'settle-work', label: '把工作坐实', event: '要不要那个「更好」的机会',
        premise: '岗位有反馈，你开始按睡眠和关系做决定，而不是按抬头。',
        later: '更好的机会也更耗人。第一次拒绝，说明尺子已经从别人手里拿了回来。',
        chance: [0.32, 0.44], boosts: { job: 0.08, major: 0.04, deep: 0.06 },
      },
      {
        id: 'gamble', label: '再赌一把', event: '离职重来还是留下',
        premise: '空窗、存款、家庭态度这些最坏结果已经摊开，不是用决心代替思考。',
        later: '绕路不一定白走，但三年打水漂的人会告诉你：先问自己为什么，再问勇不勇敢。',
        chance: [0.14, 0.24], boosts: { second: 0.06, switch30: 0.08, pause: 0.05 },
      },
      {
        id: 'new-ruler', label: '换一套自己的尺子', event: '继续证明还是改口',
        premise: '你开始拒绝用别人的进度条衡量自己，哪怕看起来不够传奇。',
        later: '十五岁太早被写成结局，二十六岁也可以改口。建议可以听，耳朵不能借走。',
        chance: [0.20, 0.32], boosts: { exam: 0.05, ordinary: 0.04 },
      },
    ],
  },
  {
    age: 27,
    hub: '履历之外还要不要生活',
    eraExtra: '二十七岁，婚礼请柬和晋升节点挤在同一张桌上。有人把人写进日历，有人继续加注自己。',
    merge: '前瞻到此结束。要验证哪一条，可以回到三岔口前进，或结束回测。',
    branches: [
      {
        id: 'relation', label: '把关系放进日程', event: '要不要为具体的人留位置',
        premise: '事业推进解决不了晚上的空，你愿意让效率下降一点。',
        later: '把日历从项目改成「人也在里面」。效率下降，生活出现了。履历填不满的部分，通常要留给一个具体的人。',
        chance: [0.22, 0.34], boosts: { exam: 0.05, care: 0.08, settle: 0.06 },
      },
      {
        id: 'double-down', label: '继续加注能力', event: '成家叙事 vs 继续长',
        premise: '你不是在逃避生活，只是还没到把能力换成生活的节点。',
        later: '比较开始变少。仍在加注能力，但不再用婚礼请柬衡量进度。迟到是别人的表。',
        chance: [0.24, 0.36], boosts: { intern: 0.06, second: 0.04, sprint: 0.08 },
      },
      {
        id: 'verify', label: '先验证再决定转型', event: '冲动转行还是验证后转',
        premise: '兴趣已经变成作品，并且有人付过费；否则先别裸辞。',
        later: '二十八岁的转型题，二十七岁就可以先做最小验证。把兴趣当能力，是这类事件里最常见的坑。',
        chance: [0.16, 0.28], boosts: { switch30: 0.1, pause: 0.05 },
      },
    ],
  },
]

/** The three years after the player's present age. A 40-year-old sees 41 / 42 / 43. */
export function foresightAges(currentAge: number | null): [number, number, number] {
  const start = Math.min(98, Math.max(1, (currentAge ?? 24) + 1))
  return [start, Math.min(99, start + 1), Math.min(100, start + 2)]
}

export function foresightTitle(currentAge: number | null): string {
  const [first, second, third] = foresightAges(currentAge)
  return `${first} → ${second} → ${third} 岁可能的走向`
}

export function holeHintFor(id: RiftKind, currentAge: number | null): string {
  if (id === 'foresight') {
    const [first, , third] = foresightAges(currentAge)
    return `看 ${first}–${third} 岁的可能`
  }
  return holeById(id)?.hint ?? ''
}

export function foresightYearsFor(currentAge: number | null): ForesightYear[] {
  const ages = foresightAges(currentAge)
  return FORESIGHT_YEARS.map((year, index) => ({
    ...year,
    age: ages[index],
    eraExtra: `${ages[index]}岁。${year.eraExtra.replace(/^二[十五六七]+岁(?:这一年)?[，]?/, '')}`,
    merge: index === 0
      ? `三条事件抉择在 ${ages[1]} 岁再次交汇——前瞻不是单线命运。`
      : index === 1
        ? `无论 ${ages[0]} 岁怎么选，${ages[1]} 岁都会再问一次：你用什么当尺子。`
        : year.merge,
    branches: year.branches.map(branch => ({
      ...branch,
      later: branch.later
        .replaceAll('二十八岁', `${ages[2] + 1}岁`)
        .replaceAll('二十七岁', `${ages[2]}岁`),
    })),
  }))
}

export function chanceText(branch: ForesightBranch, lastChoiceId?: string | null): string {
  let [lo, hi] = branch.chance
  if (lastChoiceId && branch.boosts?.[lastChoiceId]) {
    lo += branch.boosts[lastChoiceId]
    hi += branch.boosts[lastChoiceId]
  }
  lo = Math.max(0.08, Math.min(0.62, lo))
  hi = Math.max(lo + 0.06, Math.min(0.72, hi))
  return `${Math.round(lo * 100)}%–${Math.round(hi * 100)}% 相似路径`
}

export function foresightTeller(age: number, branchIndex: number): EraNpc {
  const node = eraNodeForAge(age >= 27 ? 30 : 25)
  return node.choices[branchIndex % node.choices.length].npc
}

export function closestForesightId(year: ForesightYear, lastChoiceId?: string | null): string {
  let best = year.branches[0]
  let bestBoost = -1
  for (const branch of year.branches) {
    const boost = lastChoiceId ? (branch.boosts?.[lastChoiceId] ?? 0) : 0
    if (boost > bestBoost) { best = branch; bestBoost = boost }
  }
  return best.id
}

/** Local fallback post. Live Zhihu search fills the same shape with source: 'zhihu'. */
export type ChoicePost = {
  source: 'demo' | 'zhihu'
  choiceId: string
  age: number
  title: string
  author: string
  identity: string
  excerpt: string
  paragraphs: string[]
  votes: string
  href: string
  avatar?: string
}

export function choicePostFor(age: number, choiceId: string): ChoicePost {
  const node = eraNodeForAge(age)
  const choice = eraChoice(age, choiceId) ?? node.choices[0]
  return {
    source: 'demo',
    choiceId: choice.id,
    age: node.age,
    title: `${node.age} 岁如果选了「${choice.label}」`,
    author: choice.npc.name,
    identity: choice.npc.identity,
    excerpt: choice.npc.proposition,
    paragraphs: [choice.npc.match, choice.npc.causal.choice, choice.npc.causal.cost, choice.npc.causal.reflection],
    votes: `${choice.peer}% 的同龄人走过相近的路`,
    href: 'https://www.zhihu.com',
  }
}

/** Demo archive for a companion blogger. Swap when the real author timeline is ready. */
export function bloggerArchiveFor(item: { npc: EraNpc, choice: { id: string, label: string, peer: number, reason: string }, age: number }): ChoicePost[] {
  const { npc, choice, age } = item
  const later = Math.min(age + 3, 100)
  const lookingBack = Math.min(age + 7, 100)
  return [
    {
      source: 'demo',
      choiceId: choice.id,
      age,
      title: `${age} 岁那年，我为什么选了「${choice.label}」`,
      author: npc.name,
      identity: npc.identity,
      excerpt: npc.proposition,
      paragraphs: [choice.reason, npc.match],
      votes: `${choice.peer}% 的同龄人走过相近的路`,
      href: 'https://www.zhihu.com',
    },
    {
      source: 'demo',
      choiceId: choice.id,
      age: later,
      title: `${later} 岁回看：先付出去的那些`,
      author: npc.name,
      identity: npc.identity,
      excerpt: npc.causal.cost,
      paragraphs: [npc.causal.cost, npc.causal.choice],
      votes: '演示帖子 · 不是真实匹配结果',
      href: 'https://www.zhihu.com',
    },
    {
      source: 'demo',
      choiceId: choice.id,
      age: lookingBack,
      title: `${lookingBack} 岁还在想：如果再选一次`,
      author: npc.name,
      identity: npc.identity,
      excerpt: npc.causal.reflection,
      paragraphs: [npc.causal.reflection, npc.causal.background],
      votes: '演示帖子 · 不是真实匹配结果',
      href: 'https://www.zhihu.com',
    },
  ]
}

export const END_INSIGHT = '看来你对自己当时的选择，有了不一样的体会。'
export const END_LEAD = '这条回测不是命运判决，只是把被推着走的几年，重新看成可审视的选择链。'

export type EndSkyLetter = {
  kicker: string
  era: string
  reading: string
  courage: string
  blessing: string
}

export function endSkyLetterFor(planted: Array<{ age: number, choiceId: string, label?: string }>, plans = '', currentAge: number | null = null): EndSkyLetter {
  if (!planted.length) {
    return {
      kicker: '时代里的轨迹',
      era: '这一局还没有在月面上留下花。空白也是一种坐标：你还站在选择发生之前。',
      reading: '没有种下的路，不等于没有走过的人生。它只是还没被写成可回看的句子。',
      courage: '不必急着补全。先承认自己还在场，就已经比很多沉默的年份更诚实。',
      blessing: plans
        ? `你写下的打算是「${plans}」。愿它不被催促改口，也愿你给它留一点试错的位置。`
        : '愿下一次伸手时，你仍有权把空白写成开始，而不是写成亏欠。',
    }
  }

  const first = planted[0]
  const last = planted[planted.length - 1]
  const firstNode = eraNodeForAge(first.age)
  const lastNode = eraNodeForAge(last.age)
  const lastChoice = last.choiceId === 'own'
    ? ownChoice(last.age, last.label ?? '')
    : eraChoice(last.age, last.choiceId) ?? lastNode.choices[0]
  const steps = planted.map(item => {
    const choice = item.label || eraChoice(item.age, item.choiceId)?.label
    return `${item.age} 岁的「${choice ?? item.choiceId}」`
  })
  const trail = steps.length === 1 ? steps[0] : `${steps.slice(0, -1).join('、')}，再到${steps.at(-1)}`
  const now = currentAge !== null ? `你现在 ${currentAge} 岁。` : ''

  return {
    kicker: '时代里的轨迹',
    era: lastNode.era,
    reading: `${now}从 ${firstNode.age} 岁的「${firstNode.event}」，走到 ${lastNode.age} 岁的「${lastNode.event}」，你写下了${trail}。这不是一份成绩单，是一条被时代推着、也被你接住的轨迹。${lastChoice.npc.causal.background}`,
    courage: `${lastChoice.npc.proposition}。${lastChoice.npc.causal.reflection}。路可以改口，但你已经证明：自己能把被推着走的几年，重新看成选择。`,
    blessing: plans
      ? `你给以后写下的是「${plans}」。愿时代的噪音小一点，愿这句打算有地方落地，也愿你在下一次分岔时，仍记得来得及的定义权在自己手里。`
      : '愿尚未发生的年，对你更宽一点。不是要你走成谁，是愿你在下一道题面前，仍有力气为自己负责。',
  }
}

export const DEMO_EXITS = [
  { title: '阅读原文（演示）', href: 'https://www.zhihu.com', copy: '回到公开回答看完整论证。本页不接真实匹配。' },
  { title: '知识付费咨询（演示入口）', href: 'https://www.zhihu.com/consult', copy: '若还想把某个节点聊清楚，可以从同领域答主进入咨询。' },
  { title: '盐选会员（演示入口）', href: 'https://www.zhihu.com/xen/market/vip', copy: '把「看懂选择」继续变成可阅读的长内容与专栏。' },
]
