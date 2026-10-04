# ClassHub / Homepage art direction prototype

## Pass 1 — compact design plan

**THE LIVING DIGITAL CLASS.** 把首页做成一本仍在被写下的班级时间刊物。开场确认共同身份，随后从今天走向未来，再回到记忆，最后回到人。

### Palette

| Name | Light | Role |
| --- | --- | --- |
| Paper | `#F1F0E9` | 阅读与留白 |
| Ink | `#272A27` | 主文字 |
| Quiet | `#60635D` | 元数据 |
| Rule | `#CCCFC5` | 目录、日期的真实边界 |
| Archive red | `#8B2E35` | 当前位置、关键时间、焦点 |
| Light field | `#E2E1D7` | 中性影像构图的底色 |

Dark: Paper `#212622` / Ink `#E9E9DF` / Quiet `#B1B9AC` / Rule `#485245` / Archive red `#EAA49D` / Light field `#343C34`。

### Type

- 思源宋体 SC：巨大中文、叙事标题；字形保持完整，不挤压中文宽度。
- 思源黑体 SC：正文、目录、导航、元数据。
- Schibsted Grotesk：英文、日期、Pulse 数字、文字标识。
- 得意黑：只在 Ending 的一句手写式短语出现。
- 从 Typography Lab 已缓存的同一批官方字体制作本页子集。保留可变轴、排版特性、OFL；没有新的字体下载。

### Grid & rhythm

桌面 12 栏，平板 8 栏，手机 4 栏。桌面外边距约 4.2vw、最高 80px；最大内容 1600px。桌面 gutter 24px，平板 18px，手机 12px；手机 margin 20px。正文阅读宽度不超过 32em。

```text
Arrival     在一起。                     a class,
                         在发生。        in time.
            日期               身份与一句说明
NOW         今日标题             时间、记录
            [           full bleed light field          ]
Pulse       03             12
                                         08
Upcoming    十月     日期 / 名称 / 时间 / 查看
Class Life  [大图                  ]   [竖向细节]
            图注、短故事        [小图]
Knowledge   短标题       八条紧凑目录
Timeline    大年份 sticky        不同长度的影像与故事
People      集体文字             日常中的关系
Ending      这一页，先记到这里。         一个页角伙伴
```

以左对齐为阅读基础，用明确的栏位偏移制造节奏。全宽影像、Pulse 的连续构图、Knowledge 的高密度、Timeline 的持续年份有不同的阅读速度。

### Principles

1. 时间是结构：今天、下一次、已经留下的东西。
2. 同学关系是内容：下课、共学、借笔、等人，而不是商业产品承诺。
3. 留白用于改变阅读速度；细线仅用于目录与时间关系。
4. 只用一个有限的开场动效。自然滚动中的 sticky 年份解释时间关系。
5. 示例数据、示例记忆、中性影像明确标注；不暗示这是正式班级事实。

## Pass 2 — review before implementation

- 删除原先接近提示示例的“一个／真正活着的／数字班级”三行开场。改为“在一起。／在发生。”，将核心概念放在安静的说明里。共同身份与正在发生的事情形成两句对应。
- 保留 brief 指定的纸色与宋体，但不用陶土色、纸张噪点、报纸式每节编号或全页横线。深红只承担时间和位置的含义。
- Pulse 的数字来自三组本地样本，明示样本统计。禁止仿造实时连接或匿名公开真实班级数据。
- 无来源确认的班级摄影。使用本地 SVG 光影构图测试全宽、竖裁、细节裁切；图注和 alt 明确说明占位。真实摄影的色彩、人物与共同记忆仍需人工素材替换才能判断。
- 手机不是缩小桌面：两行标题重排、日期改为横行、Pulse 两层排列、图片重新裁切、年份成为每组的行内标题、导航改为独立对话框。
- 本轮为 Prototype 对字体与红色候选的补充实验，不修改正式宪章、正式 tokens 或生产实现。

## Review boundary

九个叙事段落全部完成后，只验证这个目录的启动、构建、响应式、字体、主题、动效、网格、基础可访问性。停止，等待人工 ART DIRECTION REVIEW。
