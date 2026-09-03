# 花朵连续生长：场景约定

- 玩家意图：亲手种下某一段岁月，看它从种子成长为该章花形。
- 主动作：选择章节 → 人物走近并播种 → 起身观察生长 → 花形稳定后查看记录。
- 镜头与美术：不动现有月面、地球、人物与镜头；复用已确认的16帧，统一尺寸和根部锚点，保持像素风。预览图的棋盘格须清理，不能叠进游戏。
- 动效：按种子、发芽、幼苗、结苞、渐开、盛开、初落、渐落、结籽顺序播放；0–10停在种子，10–20停在花苞，20–30停在微开，30–40停在盛开，40–50停在初落，50–60停在渐落，60–70及以后停在结籽。
- 声音：落种与成长完成各一次短反馈，不为每帧叠加音效。
- 资料与证据：保留原年龄、回溯起点、笔记与已种植存档；队友人生内容接口保持待接入。本轮不新增真实人物或预测。
- 出口：仅生长完成才写入新种植；重复点击已种植章节仍轻触后查看记录。R取消尚未完成的生长，不删除旧资料；提供独立“重看生长”入口供旧存档体验，不重复写入种植或笔记。
- 架构：沿用现有Canvas/DOM。独立可测试的花朵时间轴；共享游戏更新时钟，后台和阅读时暂停，不用CSS压缩最终花形伪装成长。

## 已实现的时间轴

所有新种植和显式重放从第1帧开始，逐帧走到终点；普通已种植章节点击仍然是走近、轻触、打开记录。

| 年龄章节 | 停留姿态 | 终点帧（从1计数） | 从落种起的花朵时长 |
| --- | --- | --- | --- |
| 0—10岁 | 种子 | 1 | 0.60秒 |
| 10—20岁 | 含苞 | 6 | 2.64秒 |
| 20—30岁 | 微微开放 | 8 | 3.52秒 |
| 30—40岁 | 盛放 | 11 | 4.92秒 |
| 40—50岁 | 初落 | 13 | 5.80秒 |
| 50—60岁 | 渐落 | 14 | 6.26秒 |
| 60—70岁及以后 | 结籽 | 16 | 7.32秒 |

上述时间不含走近和蹲下。种子章节仍等人物完成播种、起身动作后才结束；其余章节起身后增加观察阶段，等待生长走完。年龄只是本游戏既定的花形隐喻，并非对现实人生状态的判断。

帧间仅有0.12秒的相邻姿态透明度过渡，分8档取样，播放更新为30Hz。素材没有逐帧拉伸或放大，未声称生成新的中间形态。低动态偏好保留顺序关键帧但关闭混合。根部坐标固定，只有花自身轮廓变化；末帧稳定，不循环回种子。取消不写入新的种植记录，重放也不重复写入已种植状态。

## 资产来源与规范化

- 已确认的16帧原稿：`outputs/garden-flower-lifecycle/approved-reference.png`。
- 原稿是RGB，灰白棋盘格实际画在图上。本轮用内置图片编辑仅清理背景，保留16格顺序、植物风格和形态；输出：`outputs/garden-flower-lifecycle/clean-rgba.png`，1254×1254，实际RGBA透明。
- 规范化脚本：`scripts/prepare_flower_lifecycle.py`，复用项目精灵工具。按实测空白行分隔 `[0, 297, 592, 898, 1254]` 裁切，避免均分时截掉花头。16帧采用同一缩放比例，以土壤底部中心对齐，不让脱落的种子移动主干锚点。
- 成品图集：`public/assets/garden/flower-lifecycle-v1.png`，2048×128；单帧128×128，底部基线y=124。
- 单帧：`public/assets/garden/flower-lifecycle-v1/01.png` 至 `16.png`。
- 检视表：`outputs/garden-flower-lifecycle/normalized-preview.png`。检视表棋盘格仅用于查看透明度，游戏图集没有棋盘背景。
- 旧花图和原人物动作素材均保留；本轮未修改门、前两幕、个人资料字段或人生内容接口。

## 验证记录（2026-09-03）

- 类型检查、生产构建通过；41项单元测试通过。
- 8项浏览器测试全部通过，涵盖完整三幕流程、资料继承、章节记录、80岁扩展、竖屏与低动态偏好、16帧顺序、终点保持、R中断和重放不覆盖存档。
- 截图：`playtest/flower-growth-01.png`、`03.png`、`06.png`、`08.png`、`11.png`（后四张同一文件名前缀），以及 `flower-wither-13.png`、`14.png`、`16.png`。恢复状态见 `flower-growth-cancel-narrow.png` 和 `flower-replay-cancel.png`；竖屏见 `garden-05-portrait.png`。
- 应用内现有花园页面重新加载后，用20—30岁已种植章节完成真实UI试玩：走近轻触、打开记录、关闭记录、点击重看、经过生长后停在微开形态；保留现有24岁登记资料，未清空存档。
- 导演视觉复核：归类为可交互游戏场景框架。世界仍占主体，种植是可发现的主动作，人物位于花旁，种子到花苞到开花的大小变化来自素材而非CSS拉伸；花根与土壤落点稳定。窄屏和竖屏可操作，记录和待接入内容明确区分。
- 限制：16帧是风格化关键姿态加短混合，并非高帧率植物物理生长模拟；音效由落种、结束事件触发，未主观试听；现有约598KB主包有构建体积提示，本轮未扩展为架构重构。队友真实人生内容仍待接入。

## 本轮背景提取使用的完整提示词

```text
Use case: background-extraction. EDIT ONLY THE BACKGROUND of the supplied approved 16-frame flower lifecycle sprite sheet. Remove ALL gray-and-white checkerboard squares and replace with ACTUAL ALPHA TRANSPARENCY in the exported PNG, not a picture of transparency. Preserve all 16 flower/seed/soil sprites exactly: same 4 columns by 4 rows, same pixel designs, same order, same scale and positions, same grayscale palette. No new plant design and no missing frames. Keep black outlines and white petals fully opaque. Keep the little soil patch, fallen petals and small released seeds. Preserve crisp pixel edges. Empty space between plants and all margins must be genuinely transparent with alpha zero. No text, labels, borders, gray grid, checker pattern or scenery. This is a production game asset cutout, not a new illustration. Output a square RGBA PNG with the identical 4x4 slot arrangement.
```
