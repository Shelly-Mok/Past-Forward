# 资料与内容接口交接

本文件区分**现有前端行为**和**建议由队友新增的服务协议**。没有暗中配置API地址，没有把浏览器资料上传服务器。

## 1. 已实现的数据流

```text
第二幕五问 → ArchiveProfile（内存 + sessionStorage）
  → 人物抵达门口：archive-door-arrived.detail.profile
  → main.ts白场交接 → gardenScene.show(profile)
  → 清理字段 / 解析回溯目标 / 恢复匹配存档
  → GardenState（内存 + localStorage）
  → 打开年龄档案：garden-node-request.detail
  → 队友待实现的内容服务
```

### 原始登记

定义位置：`src/archive/archiveInterview.ts`。

```ts
type ArchiveQuestionId = 'age' | 'gender' | 'family' | 'status' | 'rewind'
type ArchiveProfile = Partial<Record<ArchiveQuestionId, string>>
```

五项都是原始字符串，不是后端已经规整好的画像。`age` 是现实年龄，`gender`允许不透露；`family`、`status`是当前家庭／工作学习上下文；`rewind`是用户想回去的年龄、年份或阶段原话。

### 花园状态

定义位置：`src/garden/gardenState.ts`。不要在模型接入时复制一套与之冲突的年龄逻辑。

```ts
type RewindTarget = {
  raw: string
  kind: 'age' | 'year' | 'stage' | 'missing'
  age: number | null
  year: number | null
}
type GardenRecord = { age: number; text: string; recordedAt: string }
type PlantedChoice = { age: number; choiceId: string }
type GardenState = {
  version: 2
  profile: ArchiveProfile
  currentAge: number | null
  target: RewindTarget
  selectedAge: number
  planted: PlantedChoice[]
  records: GardenRecord[]
  recordedAt: string
  reachedPresent: boolean
}
```

| 字段 | 含义与边界 |
| --- | --- |
| `currentAge` | 现实年龄，未知是null，不是0；清理后范围0—100，但第二幕采集校验为10—100 |
| `target.raw` | 第二幕原话，确认年龄后也保留 |
| `target.age` | 明确解析或由用户补充确认的回溯年龄 |
| `target.year` | 原话明确是年份时保留；不能据此猜出生年 |
| `selectedAge` | 此刻正在浏览的年龄，切时间线只改它，不改现实年龄和原始目标 |
| `planted` | 已种下的具体年龄与当时选择，按种植顺序；**不是**章节索引0—7。恢复时丢掉 `age > currentAge` 的项 |
| `reachedPresent` | 是否已经走到现年、进入月面三岔口。档案室出门进入第三幕会新建花园，不沿用上一局的三岔口 |
| `records` | 用户主动记下的文字；不是模型输出、现实事实核验或问答历史 |
| `recordedAt` | 状态元数据；不要拿它当用户出生时间或推算历史年份 |

例如现实24岁／原话“毕业前”：先保存原话，新花园从 0 岁打开，同时提示确认回溯年龄。用户确认18后：`currentAge=24`、`target.raw='毕业前'`、`target.age=18`，`selectedAge` 仍从 0 起，点时间线才改正在看的岁数。

`18岁`可直接定位；`2020年`只解析为year；用户补年龄后可以同时保留year和age，但仍不是完整出生日期。默认年龄节点中不包含生日和精确时代年份。

## 2. 已存在的事件（不是HTTP端点）

| 事件 | 监听目标 | 触发条件／detail |
| --- | --- | --- |
| `life-backtest:start` | `window` | 点击开始回测；无业务detail |
| `life-backtest:warp-complete` | `window` | 穿梭完成；`{ destination: 'lunar-chronology-archive' }` |
| `life-backtest:archive-answer` | `.archive-scene`元素 | 一问完成关闭后；`{ question, profile }` |
| `life-backtest:archive-profile-ready` | `.archive-scene`元素 | 第五问完成；`{ profile }` |
| `life-backtest:archive-audit-ready` | `.archive-scene`元素 | 落座进入审查；无业务detail |
| `life-backtest:archive-portal-ready` | `.archive-scene`元素 | 门开启完毕；`{ profile }` |
| `life-backtest:archive-door-arrived` | `.archive-scene`元素 | 玩家主动走到门口；`{ profile }`；main.ts已监听并切第三幕 |
| `life-backtest:garden-node-request` | `.garden-scene`元素，**向外冒泡** | 打开时间档案；下述上下文快照 |
| `life-backtest:garden-rift-open` | `.garden-scene`元素，**向外冒泡** | 进入裂隙四页之一；`{ kind, ...GardenNodeContext }`。`kind` 为 `backtrack` / `forward` / `foresight` / `end`。帖子会先渲染本地骨架，再尝试水合知乎原文 |
| `life-backtest:garden-rift-choice` | `.garden-scene`元素，**向外冒泡** | 回溯页点开一条未选择之路；`{ kind: 'backtrack', age, choiceId, source: 'zhihu' \| 'demo', ...GardenNodeContext }`。本地骨架由 `choicePostFor()` 装配，成功检索后回填 `.garden-rift-post` |

注意：档案局事件默认不冒泡，不能只在document监听就期待收到；花园节点事件明确设置了bubbles。不要重复监听到门事件再执行第二次切幕。

### 花园节点事件detail

```ts
type GardenNodeContext = {
  profile: ArchiveProfile
  currentAge: number | null
  target: RewindTarget
  selectedAge: number
  chapter: number
  mode: 'rewind' | 'future-exploration'
  records: GardenRecord[]
  planted: PlantedChoice[]
  reachedPresent: boolean
}
```

- 由`createGardenScene.ts`的`getContext()`生成structuredClone快照，修改detail不会反写前端状态。
- 已知现实年龄且selectedAge大于currentAge时，mode为future-exploration。现实年龄未知时当前mode仍回退为rewind，**后端必须另外检查currentAge为null，不能因此认为已确认是过去**。
- records只包含当前年龄及以前的用户笔记；并非默认同意将这些文字传给服务端。
- `garden-node-request` 在打开时间档案时触发。仅悬停、单纯切时间节点、首次生长结束本身不会自动发送；已种章节再点击／左侧打开动作才进入档案。
- `garden-rift-open` 在吸入转场结束后、裂隙页可见时触发。从裂隙内切到另一页（例如前进→前瞻）也会再发一次，`kind` 为新页。detail 是 structuredClone，修改不会反写前端。
- “同代·相近选择”等按钮目前只打开待接入说明，尚未发出带signalType的服务请求。要实现人物匹配，需要队友新增这一层。
- 裂隙帖子通过本仓库 `server/zhihu-bridge.mjs` 调用官方 CLI 的知乎搜索。接口失败时回退本地演示文案，并保留「演示内容 · 不是真实匹配结果」。知乎原文只使用公开搜索字段，不把生成头像或台词冒充真实用户。
- 已实现：`GET /api/health`、`GET /api/zhihu/access`、`POST /api/life/match`、`GET /api/life/author`。本地预览打开 `/?zhihu=access` 可查看当前 Access Secret 能读到的创作、关注、收藏和搜索探针。
- 「我的」数据属于 Access Secret 所属账号，不是玩家 OAuth 登录账号。第一版不调用直答，避免消耗 100 次/天额度。
- CLI 与官方 Skill 已收进本仓库：`.codex/skills/zhihu`、`scripts/vendor/zhihu-cli-skill.zip`。`server/zhihu-bridge.mjs` 只从本项目 Skill / 本机 CLI 解析二进制，不再读取外层 `zhihu-demo`。配置步骤见 [知乎接口配置](ZHIHU_SETUP.md)。

以下只演示接收现有上下文，不包含联网，也不要把实际个人信息打印到生产日志：

```ts
document.addEventListener('life-backtest:garden-node-request', event => {
  const context = (event as CustomEvent<GardenNodeContext>).detail
  // 在此显示所选年龄的内容加载UI。
  // 用户确认必要资料可以发送后，再调用自己的服务适配器。
  // 不在这里直接修改context.profile或写覆盖现有存档。
})
document.addEventListener('life-backtest:garden-rift-open', event => {
  const detail = (event as CustomEvent<GardenNodeContext & { kind: 'backtrack' | 'forward' | 'foresight' | 'end' }>).detail
  // 按 detail.kind 替换对应裂隙页的演示文案。不要把生成内容写成真实匹配。
})
```

## 3. 本机保存和隐私

| 存储键 | 位置 | 内容 | 何时会丢失／变化 |
| --- | --- | --- | --- |
| `life-backtest.archive-profile` | sessionStorage | 当前第二幕五问原始资料 | 新一轮第二幕show/reset清除；会话结束也可能清除 |
| `life-backtest.garden.v2` | localStorage | 五问快照、目标、所选年龄、种植选择链、笔记、是否已到现年 | 浏览器清站点数据；不同登记重新建状态；不同origin互不共享。启动时会清掉旧键 `life-backtest.garden.v1` |

没有服务端登录、数据库或自动同步。当前是单份花园存档，不是多人账户系统；新登记与旧五项资料不一致时创建新花园，不能把上一个用户的进度套给新用户。正式多人场景应由队友设计账号/档案标识和迁移规则。

被禁用的存储以内存运行降级；损坏或版本不匹配数据重新初始化。R取消未完成种植不新增planted，重看不重复记账；第三幕不删除原始登记。第二幕重置会删除其会话登记，详情见总册。

第三幕原始字段清理每项最多200字符；记录加载最多100条、每条500字符。清理不是身份验证，**服务器仍要独立校验全部输入**。用户文字只以textContent／表单值显示，不用未经处理的innerHTML渲染服务响应。

## 4. 已接通的知乎检索，以及仍待做的节点服务

裂隙「未选择之路」和「TA 写过的」已对接 `POST /api/life/match` / `GET /api/life/author`。打开一年选择时，前端会再请求 `POST /api/life/nodes/query`：用出生设定、已种选择和（若玩家明确说过的）年份构造搜索，从标题/摘要里发现作者骨架之外的分岔（例如 18 岁的当兵、出国）。没有命中就只显示本地骨架（每个五年节点至少五朵，外加一朵自己写；0 岁六朵加自己写）。现年不限 24，时间线开到登记的真实年龄。玩家写下的原话会进入后续检索。

排序与「为什么是这个人」在 `src/zhihu/recommend.ts`：只陈述重合的词、种下的路、近况和原文句子，不编造匹配分数。玩家 OAuth 尚未接通；接通后把经同意的关注/收藏标题放进 `playerTopics`，走同一套查询。

下一步仍建议只做一个具体年龄节点的问题／选项服务，不需要一开始生成 0—100 岁全量内容。详细规则见 [推荐算法](RECOMMEND.md)。

### A. 取回年龄节点

建议服务方法：`loadLifeNode(request)`；HTTP名称可讨论，例如`POST /api/life/nodes/query`。**这个路径目前不存在**。年龄节点的问题与选项仍在前端 `gardenContent.ts`。

建议请求包含：

```ts
type ProposedNodeRequest = {
  requestId: string
  contextVersion: 1
  selectedAge: number
  chapter: number
  mode: 'rewind' | 'future-exploration'
  currentAge: number | null
  target: RewindTarget
  profile: Partial<ArchiveProfile> // 仅经同意且本次确有必要的字段
  confirmedCalendarYear?: number // 不可由当前年龄擅自推算
  notes?: GardenRecord[]         // 默认不发送；需独立确认必要性
}
```

建议响应包括requestId和selectedAge回显、节点稳定ID、问题、选项、时代背景、来源、空结果或不确定性。每个来源至少保留链接、作者／发布者、时间、引用范围和证据类型。模拟连接文案必须可单独识别。

### B. 作出一个选择

建议`submitLifeChoice({ requestId, nodeId, optionId, ...必要上下文 })`；响应返回choiceId、选择回顾、相近经历、下一节点。**现在前端笔记并不等于选项提交，也没有实现分支结果写回接口。**

### C. 相近人生信号

建议signalType为：same-era-similar-choice、same-era-different-choice、cross-era-similar-dilemma。返回真实可用的来源，不自动提供联系方式，不把生成头像或台词冒充真实用户。没有可用结果就显示没有找到，不伪造匹配分数。

### D. 前端结果呈现约定

1. 左侧零点小姐负责年龄、背景导语、问题与温和提示；主要行动保持在场景内。
2. 简短选择可放在左侧上下文区域，长篇证据／来源／笔记放入现有时间档案面板，避免盖住整个月面。
3. 请求中显示加载状态；失败显示重试和返回；结果为空显示缺失，不能把错误当空白成功。
4. 请求要带年龄和requestId。切龄、关面板、重置或换档时取消旧请求或丢弃迟到结果，避免把22岁内容覆盖到50岁。
5. 防止连点重复提交，服务端choiceId/幂等键约定需一起完成。
6. 未来探索不是预言；家庭／工作／性别不能被用来输出刻板且确定的人生结论。

## 5. 联调验收最小样例

这些是假想测试资料，不是真实玩家资料：当前35岁，回到18岁，选择22岁节点。

- 先验证第二幕五问确实原样进入第三幕，当前35、目标18、查看22互不覆盖。
- 打开22岁档案后，只发送经同意的字段；记录网络失败/重试/空结果状态。
- 模型提供一个有出处的问题与至少两项选择；选择后可返回一条可查看来源的经历与下一节点。
- 相近人物内容明确区分原文与模型归纳；没有来源时显示不确定。
- 快速切到25岁，之前22岁响应不覆盖25岁页面。
- 刷新／R／重新登记的保存策略由双方书面约定，不默默改变当前单机规则。

## 6. 安全与服务边界

- API密钥、模型凭据和数据库凭据只在后端环境变量，不能放VITE_*或前端源码；浏览器代码可以被用户查看。
- 本机家庭情况、就业和笔记不是“公开游戏数据”。不要上传GitHub、日志、截图报告或公开模型演示。
- 当前CI测试资料由测试用例生成，不读取操作者浏览器存档。
- 上线前确认请求同意、数据保留/删除、跨域、身份隔离和服务频率限制。
- 当前没有任何自动给真实人物发送消息的功能；后续若做联系需要独立明确授权。
