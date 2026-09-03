# 三幕联通与人物动作约定

2026-09-03后续更新：连续花朵生长已接入，播种、起身后会继续站在旁边观察，直到16帧时间轴走到该章终点才完成。新增显式“重看这一章的生长”，普通重访规则不变。最新素材、分章时间和41项单元／8项浏览器验证记录见 [garden-flower-lifecycle.md](garden-flower-lifecycle.md)；下文保留此前人物动作改动记录。

本轮只改现有月面人物交互与三幕入口，不重做门、审查影片、人物外观或队友内容模型。

- 意图：从海边走完整个回溯流程，再亲手种下某一段岁月。
- 主动作：选择章节、走近、播种／触碰、查看记录。同一章节切年龄不重复走路。
- 镜头：保持现有固定月面镜头；路径位于档案舱前的可走地面，不穿舱、不跨坑。脚底与阴影使用统一落点，人物尺寸随地面深度轻微变化。
- 声音：脚步随步态节拍，种子落地和生长完成各一次短确认；阅读和输入时安静等待。
- 证据：原有资料和目标继续继承；人生信号仍标记待接入，不新增虚构真实来源。
- 出口：人物起身等待，花朵可以再次点开记录。R取消尚未完成动作但不删除已登记资料。
- 技术边界：延用现有 Canvas/DOM 场景，将人物动作状态独立到可测试模块。现有行走帧复用，播种动作用同一角色种子帧生成整条动作，再统一尺寸与脚底锚点。
- 入口：根网址仍从第一幕开始；三幕均可在同一运行流程进入，调试网址仅作为预览捷径。最终展示根网址。

## 玩家操作与取消规则

第一幕海边／月球穿梭 → 第二幕资料登记／审查／开门 → W或前进按钮走到门口 → 全白过渡 → 第三幕月面花园。没有新增跳关说明页，也没有更改原门的动作。

悬停花朵只让光环和人物朝向响应；点击后才走近。地面四个位置固定，切换0–40岁和40岁以后时更换所对应章节。人物起始在舱门右侧，先走到舱前路线，再到种植点；不通过舱体或舷梯。第一次到达依次播放0.66秒蹲下、0.8秒播种、0.66秒起身；再次到达只轻触0.75秒后打开记录。行走用实际路程驱动步帧，中段约154场景像素／秒，端点缓入缓出。角色点击会短暂转身回应，等待时只保留轻微呼吸。

动作期间防止再次点击叠加，阅读面板和后台页面暂停角色更新。R中断未完成动作、停在当前位置并返回可操作状态，不传送、不把未完成播种写进存档；已经种好的章节、原始资料、笔记不删除。切换同章内具体年龄不移动角色。竖屏将大按钮排到月景下方，同时在角色手边绘制对应世界花朵。

## 动作资产与可复现输入

视觉复核后的落点：人物脚底停在章节光圈中心左侧62场景像素，播种手在身体右侧22像素处落下种子。角色不与高花的主轮廓重叠，花朵提示移到光圈上方，不再遮挡底部的40岁以后切页按钮。R取消时立即同步最后一帧，避免绘制节拍造成停下后又挪一步的观感。

- 使用方式：内置 `image_gen`，参考图编辑模式，一次生成六个姿势的整条透明动作；首轮连接失败后重试成功，未使用需要额外密钥的CLI。未重新生成行走角色。
- 身份参考：`public/assets/player/walk-v2/09.png`。
- 编辑画布：`outputs/garden-motion/plant-reference.png`。
- 原始输出：`outputs/garden-motion/plant-raw-v1.png`，实际1246×1246，RGBA透明。
- 游戏资产：`public/assets/player/player-plant-sheet-v1.png`，768×128；拆分帧在 `public/assets/player/plant-v1/01.png` 到 `06.png`。
- 预览：`outputs/garden-motion/plant-preview.png`。
- 规范化：`scripts/prepare_garden_actions.py` 使用项目精灵工具，对六帧统一缩放并固定脚底基线；跪姿自然降低高度，不分别撑满格子。

## 验证记录（2026-09-03）

- 类型检查、生产构建通过；37项单元测试通过。
- 六项浏览器流程测试全通过。最后调整角色与光圈间距后，重新跑第三幕三项和完整三幕一项，四项再次通过。
- 完整链路从根网址起步，不注入资料或跳调试地址；用35岁／回到18岁完成第二幕登记，第三幕准确继承并可亲手种下10–20岁章节。
- 首个可操作画面、走路中、蹲下／播种、80岁阶段、记录面板、R中断、390px竖屏与低动态偏好均有截图。对应证据在 `playtest/garden-motion-*.png`、`playtest/garden-*.png`、`playtest/three-acts-06-planted.png`。
- 另外在应用内真实浏览器试玩已种植章节，验证走近、轻触、打开记录；最后点击“从第一幕重新体验”，确认根网址显示可滚动靠近月亮的海边开场。
- 导演视觉分类：可交互的游戏场景框架，世界占主体，人物参与行动，UI光环表示章节；未伪造内容系统已接通。横屏为主要演示形态，竖屏提供滚动操作。
- 限制：声音触发与角色状态同源，未主观试听；原有约596KB主包仍有体积提示，未在本次改动中重构。队友的真实人生内容系统仍待接入。

## 生成使用的完整提示词

```text
Use case: identity-preserve. Production transparent pixel-art animation asset for an existing monochrome adventure game. Edit the supplied reference canvas into ONE horizontal row of EXACTLY SIX evenly spaced sprite frames, left to right. Input 1 is the edit canvas with the approved player in the first of six 256px-wide slots. Preserve this exact small adult protagonist: short rounded messy black hair, pale face barely seen in right-side three-quarter view, charcoal collared hip-length jacket, black trousers, plain dark shoes, tiny silver rim highlights. No new costume, no scarf, no backpack, no astronaut helmet. Same body/head proportions, face, identity and 16/32-bit pixel clusters, not a new character. ALL SIX figures face RIGHT. Keep same physical scale across all frames; kneeling naturally reduces occupied height, DO NOT enlarge kneeling figures to fill slots. Full body and hands visible, no crop. Feet on one identical ground baseline and ankle root near horizontal center of each slot. Whole one-row strip at once, no collage or multiple rows. Frame1 quiet upright standing, hands at sides. Frame2 bends knees slightly, torso leaning forward, right hand starting to reach down. Frame3 one knee nearly down, torso leaning, right arm extends forward/down toward ground. Frame4 deep stable kneel, fingers delicately place a tiny seed on ground slightly to the right of the shoes, visible bent knees and planted supporting foot. Frame5 rises halfway, straightens knees, retracts arm. Frame6 fully upright again, relaxed looking at the seed. Actual transparent RGBA background, preserve alpha; no checkerboard painted into background, no solid background, no ground plane, no text, no labels, no numbers, no panels, no glow, no shadow blobs or scenery. Single square transparent canvas 1536x1536, character row vertically centered like reference, each character entirely within its assigned sixth of width. Use crisp hard pixels and subdued grayscale matching input. This is an animation strip to ship in a game, not concept art.
```
