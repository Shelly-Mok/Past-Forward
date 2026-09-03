# 人生回测 · Life Backtest

三幕联通的黑白像素浏览器游戏前端：海边靠近月球 → 月球回溯与穿梭 → 月面档案局五问／审查／开门 → 玩家走进门 → 全白过渡 → 月面人生花园。

**交接基线：2026-09-03。当前是可玩的前端框架，不是已经接通真实人生模型的完整产品。** 花园包含人物走近、播种、16关键帧连续生长、年龄时间线和本机记录。检索、时代背景、相近人物、选择后果与服务端存储由队友后续接入。

## 先看哪里

| 阅读目的 | 文档 |
| --- | --- |
| 三幕完整玩法、每个操作和边界 | [队友交接总册](docs/TEAM_HANDOFF.md) |
| 第二幕资料如何传给第三幕、模型怎么接 | [数据与接口交接](docs/INTEGRATION.md) |
| 本地项目怎样上传 GitHub | [仓库上传说明](docs/GITHUB_UPLOAD.md) |
| 素材、动画、生成源文件 | [素材索引](docs/ASSET_INDEX.md) |
| 如何验收和演示 | [验收清单](docs/ACCEPTANCE.md) |

## 队友第一次运行

在**本README所在目录**执行。无需Codex、Python、后端账户或API密钥即可玩当前前端。

准备 Node.js 24（项目最低22.12），安装项目固定使用的pnpm：

```sh
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 4174 --strictPort
```

打开 http://127.0.0.1:4174/ 从第一幕开始。电脑横屏是主要演示形态。

| 地址 | 用途 |
| --- | --- |
| `/` | 正式完整三幕入口 |
| `/?scene=archive` 或 `/?debug=archive` | 第二幕开发预览，会开始新的登记流程 |
| `/?scene=garden` 或 `/?debug=garden` | 第三幕开发预览，按当前浏览器保存恢复；没有资料则明确提示缺失 |

不要把花园调试链接当作完整游戏的首页。不要直接双击index.html，需要通过本地服务器访问。

## 验证、构建

```sh
pnpm verify
pnpm exec playwright install chromium
pnpm test:e2e
```

- `verify`：类型检查、单元测试、生产构建、发布文件检查。
- `test:e2e`：自动启动／复用4174端口，跑浏览器流程；不用手动开启第二个服务器。
- `test:flow`：只验证完整三幕链路。
- `pnpm preview --host 127.0.0.1 --port 4175`：查看构建后的dist。
- 可用 `PLAYWRIGHT_PORT` 更换测试端口；`PLAYWRIGHT_EXECUTABLE_PATH` 可指定已有浏览器，默认使用安装的Playwright Chromium。Windows、macOS、Linux不再依赖固定的本机Chrome路径。
- 若受限桌面环境不允许测试程序自动结束子服务器，先手动运行上述dev命令，再设置 `PLAYWRIGHT_SKIP_SERVER=1` 运行测试。此时测试不负责启停服务器，需要你自行保留或关闭。

依赖以pnpm-lock.yaml为准，不要同时维护第二份依赖锁文件。`.github/workflows/verify.yml` 已配置上传后的自动检查，**没有自动发布网站或上传用户资料的步骤**；云端结果须等仓库真正运行后确认。

## 项目边界

- 技术：TypeScript + Vite + Canvas/DOM；部分空间／门效果使用Three.js。不是React／Phaser项目。
- 资料：第二幕sessionStorage；第三幕localStorage。仅在当前浏览器、当前站点保存，不会同步到队友电脑。
- UI：零点小姐统一在左侧叙述；第二幕右下回答；第三幕花朵、年龄和人物实时绘制，不是整屏截图。
- 当前并未从用户的三分钟视频自动提取或实现模型；本仓库只提供可承接队友模型的场景和上下文。
- 不预测未来，不把模拟影像包装成真实人物经历。

## 交付／上传

这个文件夹就是准备上传的项目根目录，不要上传外层个人工作区、node_modules、dist或浏览器存档。Windows可运行以下命令生成干净交接文件夹和ZIP：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/export-handoff.ps1
```

输出到 `outputs/handoff/`，不会删除原文件。先读 [GitHub上传说明](docs/GITHUB_UPLOAD.md)，确认目标仓库和可见性再上传。

公开许可尚未由项目负责人确定；没有擅自添加开源许可证。素材和来源内容应先核实授权，默认以团队内部交接为用途。
