# 素材与动画索引

运行游戏只需public里的成品，不需要队友重新生成图片。角色、文案、花朵和背景分层，不能把截图里的玩家和文字再叠一遍。

## 当前运行素材

| 路径（相对public） | 用途 | 注意事项 |
| --- | --- | --- |
| `assets/opening-shore-master.png` | 第一幕海岸主图 | 画布分区生成水面／小船的克制环境动作 |
| `assets/opening-space-moon.png` | 星空和月球 | 月球拖拽由运行时控制 |
| `assets/archive-walk-clean-v1.png` | 档案局步行底图 | 保持既定道路和门位置 |
| `concepts/archive-zoned-seated-memories-v2.png` | 档案局落座状态 | 虽在concepts目录仍被运行时引用，不能整目录删掉 |
| `assets/archive-vault-open-v1.png` | 已开门场景层 | 当前门版本的一部分，不在交接中替换 |
| `assets/archive-tv-bezel-v1.png` | 审查电视边框 | 影片与边框独立绘制 |
| `assets/memories/parallel-life-atlas-v1.png` | 模拟人生影片图集 | 非真实人物证据／非个性化模型结果 |
| `assets/memories/leave-life-film-v1.png` | 离开人生影片图集 | 同上 |
| `assets/player/player-walk-sheet-v2.png` | 单一玩家行走图集 | 12个128px帧，保留外形、服装和比例 |
| `assets/player/player-plant-sheet-v1.png` | 蹲下、播种、起身动作 | 6个128px帧，同一主角 |
| `assets/garden/moon-garden-clean-v1.png` | 月面花园底图 | 保留地球、档案舱；不烧录主角和互动文字 |
| `assets/garden/flower-lifecycle-v1.png` | 现行连续生长图集 | 16×128px，2048×128，真实透明，固定根部 |

单帧备份在player/walk-v2、player/plant-v1、garden/flower-lifecycle-v1对应目录。`flower-reference-v1.png`是旧年龄花形参考，不再是当前生长图集。其他concepts图和早期源图为设计历史，本次保留而非擅自删除；不是所有保留图都在运行时加载。

## 16帧的顺序

01种子 → 02破壳 → 03发芽 → 04长叶 → 05结苞 → 06含苞 → 07花苞舒展 → 08微开 → 09渐开 → 10半开 → 11盛放 → 12低垂 → 13初落 → 14渐落 → 15残瓣 → 16结籽。

每个新章节从01播放到该年龄终点；同一帧尺度不变、根部基线y=124。完整节拍、透明处理提示词和视觉验证见 [花朵连续生长](garden-flower-lifecycle.md)。不要把短帧间混合误称为额外生成的几十帧。

## 可选的素材重打包

此交付把原本依赖外层个人工作区的工具和必要源图带进仓库，游戏安装和运行不依赖它们。

| 生成入口 | 输入 | 输出 |
| --- | --- | --- |
| `scripts/prepare_player_sheet.py` | public/assets/player-walk-sheet-raw-v2.png | 行走图集与12张单帧 |
| `scripts/prepare_garden_actions.py` | asset-sources/player/plant-raw-v1.png + 已确认行走帧 | 播种图集与6张单帧 |
| `scripts/prepare_flower_lifecycle.py` | asset-sources/flowers/clean-rgba.png | 花朵图集与16张单帧 |

共享规范化工具在`scripts/sprite_tools/normalize_sprite_strip.py`，从原项目本地工具复制而来，不需要安装Codex插件。花朵原始确认稿额外保存在`asset-sources/flowers/approved-reference.png`。

只有重新整理源图时才需要Python与Pillow；在虚拟环境安装Pillow后运行相应脚本。脚本会重写对应成品资产，先建分支／备份并比较输出。不要把原图棋盘格当透明层，不要对每个帧单独撑满格子。

`garden-player-motion.md`、`garden-flower-lifecycle.md`中的outputs路径是当时生成记录；当前可供队友使用的必要源图已经另存到上述asset-sources路径。原始工作过程输出未放进交接ZIP。

## 授权与公开边界

这些视觉来自用户提供参考和项目内生成／处理过程，不据此宣称拥有不受限制的第三方授权。公开前由负责人核实参考素材、生成工具条款与最终许可；本轮不擅自为整个仓库添加开源许可证。后续真实人物经历需要单独标明来源与使用权限。
