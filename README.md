# Past Forward / 人生回测

一个黑白像素电影化的浏览器游戏原型。玩家从海边点击月亮、拖动时间，并在回溯临界点进入不同的平行人生分支。

## 当前可玩内容

- 黑白灰像素海岸、月亮、云层与水面视差
- 点击月亮建立连接
- 按住并拖动月亮进行人生回溯
- 三条模拟分支：留下、出走、暂停
- 键盘替代操作：`Enter` 后按住 `Space`
- Web Audio 低频回溯反馈

当前版本是验证核心体验的垂直切片，尚未接入知乎真人数据或完整人生节点。

## 技术栈

- TypeScript
- Vite
- Three.js
- Vitest
- Playwright
- Web Audio API

## 本地运行

```bash
pnpm install
pnpm dev
```

默认开发地址为 `http://127.0.0.1:5173/`。

## 检查与构建

```bash
pnpm check
pnpm test
pnpm build
```

## 项目边界

游戏不会预测玩家的未来。当前路径均为模拟原型；未来如接入真实内容，将明确区分来源事实、模型推断和虚构连接材料。
