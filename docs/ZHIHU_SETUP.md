# 知乎 CLI 与 Access Secret

本仓库可以单独跑前端和后端，并调用真实知乎开放平台接口。不依赖外层的 `zhihu-demo` 或 `zhihu-hackathon`。

官方 Skill 快照在 `scripts/vendor/zhihu-cli-skill.zip`，安装后位于 `.codex/skills/zhihu`。不要改官方 Skill 内容。Access Secret 只进本机 `zhihu-cli` 钥匙串或部署平台 Secret，不进源码、环境示例以外的仓库文件、前端或日志。

## 一次配置

在本 README 所在目录：

```sh
pnpm install --frozen-lockfile
pnpm zhihu:setup
```

`zhihu:setup` 会：

1. 校验并展开官方 Skill；
2. 下载当前平台的官方 `zhihu-cli` 到用户目录（不改 PATH，不用 sudo）；
3. 报告本机是否已经有 Access Secret。

如果 `auth.configured` 为 `false`：

1. 打开 <https://developer.zhihu.com/profile>，登录后手动生成 Access Secret；
2. 运行 `pnpm zhihu:auth`，把 Secret 从标准输入写入钥匙串（终端不回显，脚本也不打印原值）；
3. 运行 `pnpm zhihu:verify`，确认鉴权、知乎搜索和热榜可用。

已经配置过的电脑再跑 `pnpm zhihu:setup` 会复用现有 CLI 和钥匙串，不会重写 Secret。

## 日常运行

```sh
pnpm dev --host 127.0.0.1 --port 4174 --strictPort
```

- 游戏：http://127.0.0.1:4174/
- 真实接口总览：http://127.0.0.1:4174/?zhihu=access
- 生产构建后：`pnpm build && pnpm start`（同一端口同时提供静态页和 `/api/*`）

`pnpm zhihu:status` 只检查本机 Skill / CLI / 鉴权，不主动消耗业务额度。

## 后端接口

| 路径 | 作用 |
| --- | --- |
| `GET /api/health` | CLI 是否找到、Access Secret 是否已配置 |
| `GET /api/zhihu/access` | 探测创作、关注、收藏、知识库、搜索和热榜 |
| `POST /api/life/match` | 按关键词做知乎公开搜索，供裂隙帖子水合 |
| `GET /api/life/author` | 按作者名 + 提示词搜索 |

前端裂隙页会先画本地演示帖，再请求上述接口。成功后替换为知乎原文链接和摘要；失败保留「演示内容 · 不是真实匹配结果」。自动化测试默认 `VITE_ZHIHU_LIVE=0`，不消耗搜索额度。

## 凭证边界

| 名称 | 用途 | 存放 |
| --- | --- | --- |
| Access Secret | 开放平台开发者接口 / CLI | 本机钥匙串；线上用 `ZHIHU_ACCESS_SECRET` |
| `ZHIHU_CLI_BIN` | 可选，覆盖 CLI 绝对路径 | 本机环境变量，不要提交 |
| OAuth App ID / App Key | 玩家「知乎登录」 | 本仓库第一版不接 |

「我的创作 / 关注 / 收藏」属于 Access Secret 所属开发者账号，不是玩家在游戏里登录的账号。第一版裂隙匹配只用公开搜索，不调用直答。

## 队友机器

把整个 `Past-Forward` 目录交给队友即可。对方需要自己申请 Access Secret 并运行 `pnpm zhihu:auth`。钥匙串不会跟着 git 走。
