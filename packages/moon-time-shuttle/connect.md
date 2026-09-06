# 月面穿梭动画接口说明

版本：`1.0.0`
页面工程：`packages/moon-time-shuttle/`
本地开发端口：`3000`
坐标基准：参考图原始画布 `1451 × 1084`，页面使用等比例舞台，端口位置以百分比保存。

## 1. 衔接原则

- 前一环节只需要将用户选择映射到一个花朵 `portId`，然后调用 `window.PastForwardJourney.startFromFlower(portId)`。
- 后一环节监听 `pf:planet-selected`，读取 `event.detail.portId`，按星球端口进入对应页面或流程。
- 所有可点击端口同时存在于 DOM 中，可通过 `[data-port-id="端口ID"]` 定位。
- 事件均派发在 `window`，事件详情均额外包含毫秒时间戳 `timestamp`。

## 2. 花朵输入端口（穿梭_1）

| 端口 ID | DOM 选择器 | 语义 | 位置 x / y |
|---|---|---|---|
| `PF-FLOWER-00` | `[data-port-id="PF-FLOWER-00"]` | 0岁 | 31.7% / 68.4% |
| `PF-FLOWER-05` | `[data-port-id="PF-FLOWER-05"]` | 5岁 | 38.3% / 68.1% |
| `PF-FLOWER-10` | `[data-port-id="PF-FLOWER-10"]` | 10岁 | 44.8% / 65.9% |
| `PF-FLOWER-15` | `[data-port-id="PF-FLOWER-15"]` | 15岁 | 51.2% / 65.4% |
| `PF-FLOWER-18` | `[data-port-id="PF-FLOWER-18"]` | 18岁 | 55.2% / 65.4% |
| `PF-FLOWER-20` | `[data-port-id="PF-FLOWER-20"]` | 20岁 | 58.1% / 65.2% |

调用示例：

```js
window.PastForwardJourney.startFromFlower('PF-FLOWER-10');
```

## 3. 星球输出端口（穿梭_2）

| 端口 ID | DOM 选择器 | 星球 | 位置 x / y |
|---|---|---|---|
| `PF-PLANET-RETURN` | `[data-port-id="PF-PLANET-RETURN"]` | 回溯 | 28.7% / 36.3% |
| `PF-PLANET-FORWARD` | `[data-port-id="PF-PLANET-FORWARD"]` | 前进 | 47.5% / 28.9% |
| `PF-PLANET-FUTURE` | `[data-port-id="PF-PLANET-FUTURE"]` | 前瞻 | 65.4% / 25.3% |
| `PF-PLANET-ENDING` | `[data-port-id="PF-PLANET-ENDING"]` | 结束 | 84.1% / 29.1% |

后续工程监听示例：

```js
window.addEventListener('pf:planet-selected', (event) => {
  const { portId, sourcePortId, label } = event.detail;
  // 根据 portId 跳转到后一环节。
});
```

## 4. 浏览器事件

| 事件名 | 触发时机 | `detail` 核心字段 |
|---|---|---|
| `pf:interface-ready` | 页面接口就绪 | `version` |
| `pf:flower-selected` | 点击或程序选择花朵 | `flowerId`, `portId`, `age` |
| `pf:flight-phase` | 每个动画阶段开始 | `phase`, `sourcePortId` |
| `pf:arrival-ready` | 四颗星球可选择 | `sourcePortId`, `planetPortIds` |
| `pf:planet-selected` | 用户选择星球 | `planetId`, `portId`, `label`, `sourcePortId` |
| `pf:journey-reset` | R 键、按钮或 API 重置 | `phase` |

动画阶段 `phase` 的固定顺序：

`idle → door-opening → boarding → sealing → launch → transit → arrived`

## 5. 全局控制 API

页面加载后提供：

```ts
window.PastForwardJourney = {
  version: '1.0.0',
  startFromFlower(idOrPortId: string): boolean,
  selectPlanet(idOrPortId: string): boolean,
  reset(): void,
  getState(): { phase: string; sourcePortId: string | null }
}
```

- `startFromFlower`：仅在 `idle` 可启动；ID 无效返回 `false`。
- `selectPlanet`：仅在 `arrived` 可调用；阶段或 ID 无效返回 `false`。
- `reset`：清除尚未执行的时间线并恢复初始月面。
- `getState`：供衔接工程读取当前阶段，不改变页面状态。

## 6. 时间线

| 相对启动时间 | 阶段 | 行为 |
|---:|---|---|
| 0 ms | `door-opening` | 舱门开启并亮起舱内光 |
| 850 ms | `boarding` | 人物从右侧走向舱门并消失在舱内 |
| 2450 ms | `sealing` | 舱门闭合，三组支脚与梯子自下而上收起 |
| 3250 ms | `launch` | 仅月面沿弧形地平线向屏幕下方退出；左上角月球和星空保持固定；无支脚飞船独立起飞 |
| 5150 ms | `transit` | 飞船继续移动至第二幕位置，四个像素白点继续原位放大 |
| 7500 ms | `arrived` | 星球端口开放，派发 `pf:arrival-ready` |

## 7. WebMCP（支持时自动注册）

- `start_moon_journey({ portId })`：与点击花朵使用同一状态和时间线。
- `select_time_planet({ portId })`：与点击星球使用同一选择事件。

浏览器不支持 `document.modelContext` 时不影响普通点击、DOM 接口和全局 API。
