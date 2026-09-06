# Moon Time Shuttle（月面穿梭动画）

这是一个与仓库主游戏完全隔离的前端 package，用于展示从月球表面登船、收起支脚与梯子、飞船起飞，到四颗时间星球逐步显现的完整动画。

本目录不会修改仓库根目录的依赖、路由或游戏代码。合作工程师可以单独运行它，也可以按照 [`connect.md`](./connect.md) 中的事件和 API 接口接入前后环节。

## 本地运行

环境要求：Node.js `22.13.0` 或更高版本。

```bash
cd packages/moon-time-shuttle
npm ci
npm run dev
```

浏览器访问：<http://localhost:3000>

生产构建：

```bash
npm run build
```

## 交互流程

1. 点击月球表面的任意一朵花。
2. 唯一的小人逐步走进飞船，舱门以原尺寸开合。
3. 飞船支脚和梯子收起直至消失。
4. 右下角月面完整地下移退出，左上角月球保持固定。
5. 飞船从第一幕位置移向第二幕位置；四个像素白点同步放大为四颗星球。
6. 到达后可选择任意星球；按 `R` 或点击重置按钮可重新体验。

## 目录说明

```text
app/
  page.tsx       动画状态、时间线、端口事件与控制 API
  globals.css    舞台布局、人物/舱门/飞船/月面/星球动画
  layout.tsx     页面元信息
public/
  穿梭_1.png             第一幕原始参考图
  穿梭_1_干净月面.png    用于保证月面移动时像素完整的处理图
  穿梭_2.png             第二幕原始参考图
connect.md       前后工程衔接接口的唯一说明文件
package.json     独立依赖与运行命令
package-lock.json 可复现的依赖版本锁定
.openai/hosting.json 已清除生产标识的本地构建配置
```

## 接入方式

- 前一环节：调用 `window.PastForwardJourney.startFromFlower(portId)`。
- 后一环节：监听 `window` 上的 `pf:planet-selected` 事件。
- DOM 自动化或联调：使用 `[data-port-id="..."]` 定位花朵和星球端口。

端口 ID、事件字段、动画阶段和调用示例请以 [`connect.md`](./connect.md) 为准。

## 在线预览

<https://moon-time-shuttle.quiet-cow-0481.chatgpt.site/>

## 协作边界

- 本 package 使用自己的 `package.json` 与锁文件，不依赖仓库根目录安装结果。
- 不要把本目录的依赖合并到仓库根目录，除非团队决定正式集成。
- 正式集成时优先消费 `connect.md` 定义的端口，而不是依赖页面内部类名或动画计时细节。
- `.openai/hosting.json` 已纳入协作包，但 `project_id` 保持为空，避免误用当前线上站点的生产托管标识。若团队需要独立发布，应创建新站点后再写入新的项目标识。
