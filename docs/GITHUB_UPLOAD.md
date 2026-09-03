# GitHub上传与队友领取

本次交接包含可运行的源码、成品素材、锁定依赖、测试和说明。目标仓库为 [Shelly-Mok/Past-Forward](https://github.com/Shelly-Mok/Past-Forward)，使用现有私有仓库的 `main` 分支；沿用2026-08-28原型提交历史，追加更新，不强制覆盖。

队友获得仓库访问权限后，可先克隆再按根README运行：

```sh
git clone https://github.com/Shelly-Mok/Past-Forward.git
cd Past-Forward
```

仓库上传是否成功以GitHub实际提交为准；源码提交**不等于网站已上线**。完整交接入口为 [TEAM_HANDOFF.md](TEAM_HANDOFF.md)，模型接入入口为 [INTEGRATION.md](INTEGRATION.md)。

## 1. 上传哪一个文件夹

上传含README、package.json、src、public的`life-backtest-game`目录内容，让README处于仓库根部。不要上传整个个人Codex工作区。

包含：src、public、docs、scripts、asset-sources、tests、配置、pnpm-lock.yaml、.github工作流、.gitignore和.gitattributes。

不包含：node_modules、dist、outputs、playtest、test-results、个人录屏、浏览器cookies/storage-state、.env、密钥和聊天截图。`.gitignore`已过滤常见本地产物；打包脚本使用额外的明确文件清单。

当前public素材约31.5MiB，最大单张约2.43MiB，不需要为这些文件特别引入Git LFS。GitHub普通Git阻止超过100MiB的单文件，浏览器上传单文件限制更低；以后加入长录屏或大视频时不要直接塞进仓库。[GitHub大文件说明](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)。

## 2. 上传前确认

- 仓库完整链接、所属个人／团队、目标分支。
- 仓库是空的还是已有README/代码。已有内容不能强推覆盖。
- 公开还是私有。团队交接可先选私有，待素材和来源授权确认后再讨论公开。
- 代码和生成／用户提供素材的许可尚未统一，不擅自添加MIT等开源许可。
- 队友能否访问私有仓库；仓库可见性不等于邀请已完成。
- 运行`pnpm verify`和`pnpm test:e2e`；检查上传文件，自动扫描不能替代人工审查。

## 3. 不熟悉命令时

可用GitHub Desktop把该文件夹添加为本地仓库，检查Changes中没有个人资料、依赖或输出目录，提交后发布到确认的目标仓库。已有远程项目则先克隆它，在新分支合并本交接内容，不用覆盖远程历史。[GitHub本地代码导入说明](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)。

ZIP是发给队友的运输包，**不是建议把整个ZIP当源码上传GitHub**；队友应解压后使用其内部文件。

## 4. 空仓库的命令方式

以下仅适用于已确认的空远程仓库、且当前目录尚未初始化Git。每步都在项目根目录执行；`YOUR_REPOSITORY_URL`必须换成负责人提供的真实仓库地址，不要照抄占位符。

```sh
git init -b main
git status --short
git add .
git diff --cached --stat
git diff --cached --check
git commit -m "Prepare three-act Life Backtest handoff"
git remote add origin YOUR_REPOSITORY_URL
git remote -v
git push -u origin main
```

若Git提示缺少提交身份，用你自己的真实姓名/邮箱配置**本仓库**；不要替队友编身份。不要把访问令牌放进远程URL或写进文档；通过GitHub Desktop或Git凭据管理器登录。

如果已有.git或origin，跳过对应初始化步骤并检查现有配置。如果push被拒绝，先检查远端内容、权限和分支保护；不要使用`--force`解决冲突。拉取已有仓库后在分支里审阅合并，而不是删除远程README或历史。

以上空仓库流程依据[GitHub官方导入文档](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)。当前Past-Forward已存在历史，不要重复初始化或以全新历史覆盖它；应克隆后正常提交、推送。

## 5. 上传以后

1. 检查仓库根README、src、public、锁文件是否齐全。
2. 等待Verify three-act game工作流：安装、类型、单元测试、构建、发布检查、浏览器测试。工作流只有读取权限，不会部署或触碰用户资料。
3. 让队友从全新文件夹克隆，严格按README安装，先开`/`完整体验。
4. 队友先读TEAM_HANDOFF和INTEGRATION，再在独立分支接模型；不要一边改接口一边重做门和主角。

## 6. 上传仓库 ≠ 发布网页

`127.0.0.1`只在自己的电脑可用，发给队友这个地址不能远程访问你的网页。

本次只准备源码仓库，不开通GitHub Pages或其他线上托管。现有资源使用`/assets/...`、`/concepts/...`与根路径链接，适合域名根目录；若以后放到GitHub Pages的`/仓库名/`子路径，需要一并适配所有资源与返回首页链接，**不能只改Vite base就宣称完成**。独立部署和在线分享请另行验收。

## 7. 生成可发给队友的ZIP

Windows项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/export-handoff.ps1
```

它会先扫描文件清单、缺失素材、明显密钥特征和大文件，再在outputs/handoff创建时间戳文件夹与ZIP，校验ZIP条目数量并打印SHA256。不覆盖旧包、不删除源文件。构建好的public素材已包含，队友不必重新调用图像生成。
