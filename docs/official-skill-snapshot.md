# 官方 zhihu-cli Skill 快照

- 来源：`https://developer-cdn.zhihu.com/zhihu-cli/releases/stable/skill/zhihu-cli-skill.zip`
- 本仓库副本：`scripts/vendor/zhihu-cli-skill.zip`
- 安装位置：`.codex/skills/zhihu`
- 包内根目录：`zhihu/`
- Skill 版本：`0.2.1`
- 本包 SHA-256：`be08e10bbd8f7c554456599e1bdf9e4a4f9216a7624d0b29218e9e4dc1c2f9f3`

`pnpm zhihu:skill` 会先校验 SHA-256 和 ZIP 路径，再覆盖安装到项目级 `.codex/skills/zhihu`。更新官方快照时必须重新下载、核对来源、更新校验值并重新跑 `pnpm zhihu:setup`。
