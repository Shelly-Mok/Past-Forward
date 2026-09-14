# 第四幕访谈与新五问 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把第二幕五问换成年龄/性别/学历/身体/人生事件，第三幕按新资料做知乎检索，并新增独立第四幕（候选人 → 访谈状态机 → 报告）。

**Architecture:** 登记与花园存档先改数据合同；检索只改 `recommend.ts` 的查询词。访谈规则放在可单测的 `interviewState.ts`，第四幕场景只负责 UI。模型与知乎密钥只在 `server/`。

**Tech Stack:** TypeScript、Vite、Vitest、现有 `/api/life/*` 知乎桥、OpenAI 兼容 `gpt-4o-mini`

**Spec:** `docs/superpowers/specs/2026-09-11-act4-life-interview-design.md`

## Global Constraints

- 性别只能是「男」或「女」，无手写、无「非二元」、无「不透露」
- 旧字段 `family` / `status` / `rewind` 不再采集；读到旧档当新局
- 回溯目标从 `lifeEvent` 解析，不从 `rewind` 读
- 性别不进入知乎查询词；`health === '良好'` 不进查询；学历仅节点年龄 ≥ 16 才进查询
- 报告按信息完整性触发，不按固定轮次；状态机决定能否出报告，模型只负责口吻
- Access Secret 与 `OPENAI_API_KEY` 不进前端、仓库、日志
- 自动化测试默认不打真实知乎、不打真实模型
- 在 `Past-Forward-main` 内实现；提交仅在用户明确要求时进行

## File Map

- Modify: `src/archive/archiveInterview.ts` — 新五问与校验
- Modify: `src/garden/gardenState.ts` — `cleanProfile`、`parseTarget(lifeEvent)`、调试档
- Modify: `src/zhihu/recommend.ts` — 新 profile 查询与解释
- Create: `src/interview/interviewState.ts` — K、四格、sparse、自动/手动触发
- Create: `src/interview/createInterviewScene.ts` — 第四幕 UI
- Create: `server/life-dialogue.mjs` — candidates / persona / dialogue / report
- Modify: `server/zhihu-bridge.mjs` — 挂上新路由
- Modify: 档案局灯、花园标签、个人标签、e2e 夹具中的旧五键
- Modify: `docs/TEAM_HANDOFF.md`、`docs/INTEGRATION.md`、`docs/RECOMMEND.md`

---

### Task 1: 第二幕新五问与存档合同

**Files:**
- Test: `src/archive/archiveInterview.test.ts`
- Modify: `src/archive/archiveInterview.ts`
- Test: `src/garden/gardenState.test.ts`
- Modify: `src/garden/gardenState.ts`
- Modify: `src/main.ts`（checkpoint `data-checkpoint`：`education` / `health`）
- Modify: `src/archive/createArchiveScene.ts`（`lifeEvent` 完成时发 `archive-profile-ready`）
- Modify: `src/outlook/personalTag.ts`、`src/outlook/personalTag.test.ts`
- Modify: `src/garden/createGardenScene.ts` 资料标签
- Modify: `tests/garden.spec.ts`、`tests/archive-door.spec.ts`

**Interfaces:**
- Consumes: 现有 `ArchiveQuestion` 形状
- Produces:

```ts
export const ARCHIVE_PROFILE_KEYS = ['age', 'gender', 'education', 'health', 'lifeEvent'] as const
export type ArchiveQuestionId = typeof ARCHIVE_PROFILE_KEYS[number]
export function lifeEventFollowUp(value: string): 'age' | 'stage' | 'year' | 'need-age'
```

- [ ] **Step 1: Write the failing interview tests**

把 `src/archive/archiveInterview.test.ts` 改成：

```ts
expect(ARCHIVE_QUESTIONS.map((question) => question.id)).toEqual([
  'age', 'gender', 'education', 'health', 'lifeEvent',
])
expect(ARCHIVE_QUESTIONS.find(q => q.id === 'gender')?.options).toEqual(['男', '女'])
expect(archiveAnswerError(ARCHIVE_QUESTIONS[1], '不透露')).not.toBe('')
expect(archiveAnswerError(ARCHIVE_QUESTIONS[1], '女')).toBe('')
expect(previousArchiveQuestion('lifeEvent')?.id).toBe('health')
expect(lifeEventFollowUp('18岁高考选了省内')).toBe('age')
expect(lifeEventFollowUp('2020年换了工作')).toBe('year')
expect(lifeEventFollowUp('毕业那年')).toBe('stage')
expect(lifeEventFollowUp('换了工作')).toBe('need-age')
expect(archiveAnswerError(ARCHIVE_QUESTIONS[4], '换了工作')).toContain('几岁')
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm exec vitest run src/archive/archiveInterview.test.ts`  
Expected: FAIL，旧 id 仍是 family/status/rewind

- [ ] **Step 3: Implement questions and validators**

`ARCHIVE_QUESTIONS` 换成 spec 第二节文案。`archiveAnswerError`：性别仅男/女；学历必须是选项之一或「其他」开头；身体必须是四选项之一或以其开头；`lifeEvent` 在 `lifeEventFollowUp === 'need-age'` 时要求补年龄。`normalizeArchiveAnswer` 对 age 仍解析整数。

- [ ] **Step 4: Fail then fix garden target tests**

把 `newGardenState({ age: '35', rewind: '18岁' })` 改为 `{ age: '35', lifeEvent: '18岁高考' }`。`parseTarget` 改为 `parseTarget(safe.lifeEvent)`。`GARDEN_DEBUG_PROFILE` 用新五键（`education: '演示 · 本科'`，`health: '良好'`，`lifeEvent: '18岁高考'`）。`debugGardenProfile` 读 `?event=`，仍兼容 `?rewind=` 写入 `lifeEvent`。`cleanProfile` / `isSkipDemoProfile` / restore 比较都用 `ARCHIVE_PROFILE_KEYS`。

- [ ] **Step 5: Update callers so `pnpm test` is green**

个人标签 `PROFILE_LABELS` 改为新五键。花园登记资料标签同步。e2e 夹具：`gender: '女'`，`education: '本科'`，`health: '良好'`，`lifeEvent: '18岁高考'`。`createArchiveScene` 里 `completedQuestion.id === 'lifeEvent'` 时发 `archive-profile-ready`。main.ts 灯 `data-checkpoint` 改为 education/health（进度仍 0.47 / 0.70）。

- [ ] **Step 6: Verify**

Run: `pnpm exec vitest run src/archive/archiveInterview.test.ts src/garden/gardenState.test.ts src/outlook/personalTag.test.ts`

---

### Task 2: 第三幕个性化查询

**Files:**
- Test: `src/zhihu/recommend.test.ts`
- Modify: `src/zhihu/recommend.ts`
- Modify: `src/zhihu/liveContent.ts`（缓存键用 `education/health/lifeEvent`）
- Modify: `src/garden/gardenRift.ts`、`createGardenScene.ts` 传入新 profile 字段

**Interfaces:**
- Consumes: `ArchiveProfile` 新五键
- Produces: `JourneyContext.profile: Pick<ArchiveProfile, 'education' | 'health' | 'lifeEvent'>`

- [ ] **Step 1: Write failing recommend tests**

```ts
const ctx = journeyContext({
  selectedAge: 18,
  currentAge: 24,
  target: { raw: '18岁高考选了省内', kind: 'age', age: 18, year: null },
  profile: { education: '本科', health: '良好', lifeEvent: '18岁高考选了省内', gender: '女' },
  planted: [{ age: 15, choiceId: 'senior' }],
})
const queries = nodeDiscoveryQueries(ctx, '高考后的去向').join(' ')
expect(queries).toContain('18岁高考选了省内')
expect(queries).toContain('本科')
expect(queries).not.toContain('良好')
expect(queries).not.toMatch(/女\s*考研/)
expect(journeyKeywords(ctx)).toContain('18岁高考选了省内')
expect(nodeDiscoveryQueries({ ...ctx, selectedAge: 8 }, '童年').join(' ')).not.toContain('本科')
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm exec vitest run src/zhihu/recommend.test.ts`

- [ ] **Step 3: Swap profile fields in queries and explanations**

`journeyContext` 只拷贝 education/health/lifeEvent。`journeyKeywords` / `nodeDiscoveryQueries` / `companionQueries` 用 `lifeEvent` 整句；学历仅 `selectedAge >= 16`；health 仅当不是「良好」。解释函数把 status/family 换成 lifeEvent/education 重合。排序里的 statusHit 改为 lifeEvent 重合。

- [ ] **Step 4: Verify**

Run: `pnpm exec vitest run src/zhihu/recommend.test.ts`

---

### Task 3: 访谈状态机

**Files:**
- Create: `src/interview/interviewState.ts`
- Create: `src/interview/interviewState.test.ts`

**Interfaces:**
- Consumes: `PlantedChoice[]`、`ArchiveProfile`、`RewindTarget`
- Produces:

```ts
export type SlotId = 'choice' | 'motive' | 'constraint' | 'alternative' | 'agency'
export type NodeStatus = 'pending' | 'interviewing' | 'complete'
export type InterviewNode = {
  id: string
  age: number
  title: string
  status: NodeStatus
  slots: Record<SlotId, string>
  sparse: Partial<Record<SlotId, boolean>>
}
export type InterviewState = {
  nodes: InterviewNode[]
  currentId: string
  closingAsked: boolean
  closingConfirmed: boolean
  report: 'none' | 'partial' | 'full'
}
export function buildNodes(planted: PlantedChoice[], profile: ArchiveProfile, currentAge: number | null): InterviewNode[]
export function isSparse(text: string): boolean
export function applyUtterance(state: InterviewState, nodeId: string, slot: SlotId, text: string): InterviewState
export function markAgency(state: InterviewState, nodeId: string, value: '主动偏好' | '条件妥协' | '两者兼有'): InterviewState
export function autoReportReady(state: InterviewState): boolean
export function manualReportPrompt(state: InterviewState): string
export function nextMissingSlot(node: InterviewNode): SlotId | null
```

`buildNodes`：按年龄合并 planted 与 `lifeEvent` 解析年龄；仍空则用 target.age + currentAge，至少 1 个节点。

- [ ] **Step 1: Write failing tests covering spec §12.1–5**

见 spec 第 12 节：K-1 不能自动出报告；sparse 不能 complete；缺 agency 不能 complete；手动返回 n/K；收尾未确认不出完整报告。

- [ ] **Step 2: Run to verify fail**

Run: `pnpm exec vitest run src/interview/interviewState.test.ts`

- [ ] **Step 3: Implement `interviewState.ts`**

`isSparse`：去标点后长度 < 8 或等于/包含「还好」「不知道」「随便」「忘了」。`applyUtterance` 在 sparse 时写入但标 sparse、保持 interviewing。五格都非 sparse 才 `complete`。`autoReportReady` 要求全部 complete 且 `closingConfirmed`。`manualReportPrompt` 列出完成/未完成标题。

- [ ] **Step 4: Verify**

Run: `pnpm exec vitest run src/interview/interviewState.test.ts`

---

### Task 4: 第四幕场景（夹具可玩）

**Files:**
- Create: `src/interview/createInterviewScene.ts`
- Create: `src/interview/interview.css`
- Modify: `src/main.ts` — 三岔口「进入回溯」show 第四幕
- Modify: `src/garden/createGardenScene.ts` / `gardenRift.ts` — `startParallel` 改为切幕而不是裂隙脚本
- Test: `src/garden/gardenRift.test.ts`（若断言仍打开旧裂隙对话则改期望）

**Interfaces:**
- Consumes: `buildNodes`、花园 `GardenNodeContext`
- Produces: `createInterviewScene(host).show(context)` / `.hide()`；事件 `life-backtest:interview-back`

画面分区按 spec §7：舞台、返回三岔口、出处抽屉、底部对话匣、个人标签入口。第一拍用夹具 2–3 候选人；点选后对话匣可输入。报告层先用状态机 + 夹具文本。

- [ ] **Step 1: Add a DOM test that the interview root has candidate list then dialog input**
- [ ] **Step 2: Run to verify fail**
- [ ] **Step 3: Implement scene; wire `startParallel` / 回溯洞到 `interviewScene.show`**
- [ ] **Step 4: Verify unit tests for interview + garden rift entry**

---

### Task 5: 对话与报告后端

**Files:**
- Create: `server/life-dialogue.mjs`
- Modify: `server/zhihu-bridge.mjs` 或 `server/serve.mjs` 挂路由
- Create: `.env.example`（只写变量名）
- Modify: `.gitignore`（确保 `.env` 被忽略）
- Test: `src/interview/dialogueContract.test.ts`（纯函数：请求体校验、报告拒绝条件；不打网）

**Interfaces:**
- `POST /api/life/candidates` `{ planted, profile, currentAge }` → `{ ok, items: [{ author, headline, quote, source }] }`
- `POST /api/life/persona` `{ author }` → `{ ok, posts: [{ title, excerpt, href }] }`
- `POST /api/life/dialogue` `{ state, nodeId, message, persona }` → `{ ok, state, reply, action }`
- `POST /api/life/report` `{ state, kind: 'partial' | 'full' }` → 完整报告在 `!autoReportReady` 时 409

模型：`POST {OPENAI_BASE_URL}/v1/chat/completions`，默认 base `https://api.openai-next.com`，model `gpt-4o-mini`。无密钥时 dialogue 返回 503，前端显示重试。系统提示用 spec 里的数字人规则；禁止输出「知乎、文本素材、检索」。

- [ ] **Step 1: Write failing contract tests for report 409 and sparse action === 'probe'**
- [ ] **Step 2: Run to verify fail**
- [ ] **Step 3: Implement routes; candidates 内部调现有 search；失败回退演示项并标 `source: 'demo'`**
- [ ] **Step 4: Wire scene to fetch these endpoints; 取消过期请求**
- [ ] **Step 5: Verify contract tests**

---

### Task 6: 文档与主路径夹具

**Files:**
- Modify: `docs/TEAM_HANDOFF.md` 五问表与第四幕入口
- Modify: `docs/INTEGRATION.md` 类型与事件
- Modify: `docs/RECOMMEND.md` 查询来源
- Modify: `docs/ZHIHU_SETUP.md` 新接口表
- Modify: `README.md` 三幕描述改为含第四幕
- Test: `tests/opening-to-archive.spec.ts` / `tests/garden.spec.ts` 夹具字段

- [ ] **Step 1: Update docs to match new field names and Act 4**
- [ ] **Step 2: Run `pnpm test` then `pnpm check`**
- [ ] **Step 3: If Playwright 已装，跑 `pnpm test:flow`（未装则记录未跑）**

---

## Spec coverage

| Spec | Task |
| --- | --- |
| §4 新五问、性别、补年龄 | 1 |
| §4.1 / §6 parseTarget 与 K | 1, 3 |
| §5 个性化检索 | 2 |
| §7 第四幕构图与候选人 | 4, 5 |
| §8–9 状态机与报告 | 3, 5 |
| §10 后端与密钥 | 5 |
| §12 测试 | 1–5 |
| §13.6 文档 | 6 |
