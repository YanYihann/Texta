---
name: Texta 小程序界面
description: 继承 Texta 的原生微信词汇输入与阅读工作区
colors:
  light-swatch: "#386548"
  light-bg: "#f6f7f4"
  light-panel: "#fcfcfa"
  light-field: "#fcfdfb"
  light-text: "#222724"
  light-muted: "#606963"
  light-line: "#d8ded7"
  light-primary: "#386548"
  light-press: "#294e37"
  light-soft: "#e8f0e7"
  light-ink: "#ffffff"
  light-highlight: "#dae8d4"
  light-highlight-zh: "#e3ebdc"
  light-vocab: "#294e37"
  light-warning: "#9b3f29"
  light-warning-bg: "#f8eee9"
  dark-swatch: "#28312a"
  dark-bg: "#1c221e"
  dark-panel: "#232c25"
  dark-field: "#28312a"
  dark-text: "#e9eee7"
  dark-muted: "#b0bbae"
  dark-line: "#3e4c3f"
  dark-primary: "#a9cda2"
  dark-press: "#c0dcb8"
  dark-soft: "#314334"
  dark-ink: "#1c281e"
  dark-highlight: "#d9ef78"
  dark-highlight-zh: "#e8f7a6"
  dark-vocab: "#202b15"
  dark-warning: "#ffb5a3"
  dark-warning-bg: "#452c27"
  highlighter-swatch: "#fff200"
  highlighter-bg: "#ffffff"
  highlighter-panel: "#ffffff"
  highlighter-field: "#ffffff"
  highlighter-text: "#202020"
  highlighter-muted: "#626262"
  highlighter-line: "#dedede"
  highlighter-primary: "#202020"
  highlighter-press: "#000000"
  highlighter-soft: "#f5f5f5"
  highlighter-ink: "#ffffff"
  highlighter-highlight: "#fff200"
  highlighter-highlight-zh: "#fff200"
  highlighter-vocab: "#202020"
  highlighter-warning: "#b4232c"
  highlighter-warning-bg: "#fff0f0"
  paper-swatch: "#f4d79f"
  paper-bg: "#fdfbf6"
  paper-panel: "#fffdf9"
  paper-field: "#fffdf9"
  paper-text: "#352b21"
  paper-muted: "#75624c"
  paper-line: "#e9e2d6"
  paper-primary: "#78522e"
  paper-press: "#5e3d20"
  paper-soft: "#f7f1e6"
  paper-ink: "#ffffff"
  paper-highlight: "#f4d79f"
  paper-highlight-zh: "#f1e0bc"
  paper-vocab: "#5e3d20"
  paper-warning: "#935022"
  paper-warning-bg: "#fbf0df"
  ocean-swatch: "#c8e8fa"
  ocean-bg: "#f2f7fa"
  ocean-panel: "#fbfdff"
  ocean-field: "#fbfdff"
  ocean-text: "#1f3340"
  ocean-muted: "#526e7e"
  ocean-line: "#ccdde7"
  ocean-primary: "#235f83"
  ocean-press: "#194969"
  ocean-soft: "#e0eef5"
  ocean-ink: "#ffffff"
  ocean-highlight: "#c8e8fa"
  ocean-highlight-zh: "#d6edf7"
  ocean-vocab: "#194969"
  ocean-warning: "#9b3f29"
  ocean-warning-bg: "#f8eee9"
  lavender-swatch: "#e0cef3"
  lavender-bg: "#f7f4fa"
  lavender-panel: "#fdfbff"
  lavender-field: "#fdfbff"
  lavender-text: "#33283f"
  lavender-muted: "#71617e"
  lavender-line: "#ded4e7"
  lavender-primary: "#70508d"
  lavender-press: "#56366f"
  lavender-soft: "#ede4f4"
  lavender-ink: "#ffffff"
  lavender-highlight: "#e0cef3"
  lavender-highlight-zh: "#eadef5"
  lavender-vocab: "#56366f"
  lavender-warning: "#95304e"
  lavender-warning-bg: "#faeaf0"
  export-paper: "#ffffff"
  export-text: "#202b24"
  export-muted: "#606963"
  export-chinese: "#4d5e52"
  export-primary: "#386548"
  export-highlight: "#e4eddd"
  export-table-head: "#edf2eb"
  export-table-stripe: "#f7f9f5"
  export-line: "#dce3da"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "70rpx"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-2rpx"
  headline:
    fontFamily: "Georgia, 'Songti SC', serif"
    fontSize: "48rpx"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontSize: "44rpx"
    fontWeight: 650
    lineHeight: 1.4
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "30rpx"
    lineHeight: 1.6
  reading:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "36rpx"
    lineHeight: 1.85
  vocabulary:
    fontFamily: "Georgia, serif"
    fontSize: "34rpx"
    lineHeight: 1.35
  label:
    fontSize: "26rpx"
rounded:
  highlight: "4rpx"
  chip: "14rpx"
  button: "16rpx"
  field: "20rpx"
  panel: "24rpx"
  sheet: "28rpx"
spacing:
  chipGap: "12rpx"
  gap: "16rpx"
  control: "20rpx"
  editor: "24rpx"
  panel: "28rpx"
  screen: "36rpx"
  section: "44rpx"
  bottom: "56rpx"
components:
  button-primary:
    backgroundColor: "{colors.light-primary}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.button}"
    padding: "0 28rpx"
    height: "88rpx"
  button-primary-active:
    backgroundColor: "{colors.light-press}"
    textColor: "{colors.light-ink}"
  button-secondary:
    backgroundColor: "{colors.light-panel}"
    textColor: "{colors.light-primary}"
    rounded: "{rounded.button}"
    padding: "0 28rpx"
    height: "88rpx"
  button-plain:
    backgroundColor: "transparent"
    textColor: "{colors.light-primary}"
    rounded: "{rounded.button}"
    padding: "0 28rpx"
    height: "88rpx"
  button-disabled:
    backgroundColor: "{colors.light-soft}"
    textColor: "{colors.light-muted}"
  word-chip:
    backgroundColor: "{colors.light-soft}"
    textColor: "{colors.light-primary}"
    rounded: "{rounded.chip}"
    typography: "{typography.vocabulary}"
  word-input:
    backgroundColor: "{colors.light-field}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.chip}"
    padding: "20rpx"
    height: "144rpx"
  panel:
    backgroundColor: "{colors.light-panel}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.panel}"
    padding: "28rpx"
  reading-highlight:
    backgroundColor: "{colors.light-highlight}"
    textColor: "{colors.light-vocab}"
    rounded: "{rounded.highlight}"
    padding: "3rpx 0"
  reading-highlight-chinese:
    backgroundColor: "{colors.light-highlight-zh}"
    textColor: "{colors.light-vocab}"
    rounded: "{rounded.highlight}"
    padding: "3rpx 0"
  export-paper:
    backgroundColor: "{colors.export-paper}"
    textColor: "{colors.export-text}"
    padding: "32rpx"
---

# Texta 小程序界面

## Overview

继承现有 Texta 的视觉系统，适配微信原生导航和窄屏，不另创品牌。中文默认界面保留绿色阅读工作区，Texta 名称、英文阅读和词汇标签使用衬线字体；操作界面使用系统中文字体。

这次已批准的系统扩展把 PC 词汇标签输入、六套配色、清晰的主次按钮和纸白导出带到小程序。沿用既有视觉语言，不另设创意隐喻。浅色是默认主题，其余主题替换同一组语义颜色；布局、内容和交互层级保持一致。

**Key Characteristics:**

- 词汇以可编辑、可删除的标签呈现，拼写辅助留在编辑器内。
- 配色作用于操作页与阅读页，导出始终使用纸白配色。
- 主按钮实心、次按钮描边、轻操作透明；原生导航与底部标签页保留。

## Colors

前置 token 是规范值；来源为 `miniprogram/utils/theme.js`。`light-*` 保留原设计的背景、阅读纸面、文字、次级文字、主色、按下、边界和词义高亮，其余五套是用户已批准的 PC 配色扩展。

### Primary

每个主题的 `primary` 用于主操作、品牌和选中状态，`press` 用于按下状态，`ink` 是实心按钮文字前景，`soft` 用于轻强调、标签和提示。深色主题的 `ink` 是深色文字，不可固定成白色。

### Neutral

`bg` 是页面背景，`panel` 是阅读纸面与面板，`field` 是输入背景，`text` 是正文，`muted` 是辅助文本，`line` 是边界。`highlight` 和 `highlight-zh` 分别承接英文与中文目标词，`vocab` 是两者共享的可读前景；`warning` 与 `warning-bg` 用于错误和可能拼写问题。`swatch` 仅用于主题选择色块。

| 主题 | 用途 |
| --- | --- |
| 浅色 (`light`) | 默认的绿色工作区 |
| 深色 (`dark`) | 低亮度阅读，亮色主按钮与深色高亮前景 |
| 荧光 (`highlighter`) | 白底、黑色操作、黄色目标词 |
| 纸张 (`paper`) | 暖纸色与棕色操作 |
| 海洋 (`ocean`) | 浅蓝纸面与蓝色操作 |
| 薰衣草 (`lavender`) | 浅紫纸面与紫色操作 |

`texta_theme_preference` 保存主题 ID；未识别 ID 回退浅色。切换时更新当前页面、原生导航栏、页面背景与底部标签栏，其他页面在 onShow 读取同一偏好。完整六套颜色均已提取到 frontmatter，不能只替换页面背景或只替换主色。

**The Semantic Foreground Rule.** 英文高亮与中文高亮均使用 var(--vocab) 前景；中文翻译的普通文本使用 var(--muted)，不能把它继承到高亮文本。

**The Paper Export Rule.** 导出预览、PDF 与 DOCX 始终使用 export-* 纸白颜色，与持久化阅读主题无关。

## Typography

- **Display**：Texta 名称使用 display，保留 Georgia 与 Times New Roman 平台回退。
- **Headline**：文章标题与词义抽屉词头使用 headline 的衬线层级；标题允许长词换行。
- **Title**：操作页标题使用 title；系统中文字体继承 body。
- **Body**：正文使用 body；中文翻译阅读行高沿用 reading。
- **Reading**：英文阅读默认使用 reading；字号按钮在 36、42、32rpx 之间切换并保存 `texta_reading_size`。中文嵌词正文使用系统中文字体回退。
- **Vocabulary**：编辑器标签使用 vocabulary；补全同样使用 Georgia。
- **Label**：次级说明使用 label；不增加虚构的显示字体。

导出预览标题为 38rpx，英文为 29rpx / 1.75，中文为 25rpx / 1.85。PDF 使用本机 canvas serif/sans-serif，标题 46px、英文 32px、中文 27px；DOCX 使用 Georgia、宋体和微软雅黑回退，英文 13pt、中文 11pt。平台字体渲染不保证像素一致。

## Layout

窄屏以单列工作区组织，原生导航栏与生成／资料库／我的三个底部标签页保留。screen 使用横向 screen 间距及 bottom 下边距，安全区通过 env(safe-area-inset-bottom) 承接；生成页为固定底部生成操作额外预留 240rpx 与安全区。输入先行，模式选择紧随其后，生成状态与配额在按钮附近说明。

词汇标签自动换行，标签区最多 400rpx 高并可滚动；输入框为 144rpx 高。主题选择为两列，列间距使用 gap。词义抽屉正文为 56vh，可关闭、可滚动。按钮以 88rpx 为最小高度（375 逻辑像素基准宽度下约 44px）；真实设备仍需检查触控与键盘遮挡。

文章在对照、英文、词汇之间切换；段落间距为 38rpx。导出设置包含标题、中文开关、8／12／16mm 页边距及滚动预览。PDF 为 A4 比例 1120 × 1584px 画布，词汇表按英文／词性／中文翻译三列布局（约 29%／15%／56%），跨页重复表头；预览使用近似的 30%／17%／53%。

## Elevation & Depth

界面通过背景、纸面、轻强调色和细边界建立层次，当前组件不使用 box-shadow。词义抽屉使用固定遮罩 `#19251f66`，抽屉层级 100；固定生成操作层级 10。不为主题增加浮动阴影或新装饰层。

## Shapes

保留原有柔和矩形：面板使用 panel 圆角，按钮使用 button，输入标签使用 chip，常规字段使用 field。词义抽屉使用 sheet 上侧圆角、下侧贴边，目标词使用 highlight 的小圆角。线条宽度为 1rpx。打印纸面和词汇表使用纸张矩形，不套用界面卡片圆角。

## Components

### Buttons

主操作使用 primary 背景与 ink 前景、600 字重，按下使用 press；次操作使用 panel 背景、primary 文字和 line 边框；轻操作透明。按钮最小高度 88rpx，默认水平内边距 28rpx，小按钮仍保持相同最小高度，改用 20rpx 内边距和 label 字号。disabled 使用 muted／soft／line，透明与标签按钮继续保留透明底色。

**The Native Button Reset Rule.** 按钮清除微信默认伪元素边框，显式设置非 mini 按钮宽度与左右外边距；全宽按钮单独设为 100%。

### Chips / Inputs

词汇标签使用 soft 背景、line 边框和 vocabulary 字体，标签文字可点击编辑，删除按钮宽度与最小宽度均为 88rpx。可能拼写问题用 warning 色波浪下划线表示；更正建议、输入补全在编辑器内出现，分隔或失焦后提交标签，不设置独立拼写检查按钮。输入获得焦点时边框使用 primary。

### Cards / Containers

原有面板使用 panel 背景、line 边框和 panel 圆角，常规内边距为 28rpx；编辑器为 24rpx。阅读纸面为 28rpx 纵向、24rpx 横向内边距。通知使用 soft／primary，错误使用 warning-bg／warning，不另设颜色系统。

### Navigation / Theme switcher

原生底部栏跟随主题的 panel、muted 与 primary。阅读切换标签在 soft 容器内，选中项使用 panel 背景和 primary 前景。主题入口为次按钮；六个色块选项显示中文名称，选中项有 primary 边框与圆点，并提供选中状态 aria-label。

### Word sheet

词义通过底部抽屉承接选词；词头使用衬线、上下文块使用 soft，关闭和加入生词操作保留明确触控区域。抽屉使用同一主题语义 token，不固定为浅色。

### Export paper

纸白预览与 PDF／DOCX 使用 export-* 颜色：英文较深、中文较弱，目标词为绿色浅底；词汇表使用浅色表头、交替行底和水平分隔线。PDF 是本机画布生成的图片型 PDF，文字不可直接选择；DOCX 为可编辑 OOXML 文档。内容以同一 documentModel 产生，设置影响标题、中文与页边距，不影响阅读主题。

## Do's and Don'ts

### Do:

- **Do** 继承 Texta 名称、中文默认界面、英文衬线阅读和原生微信导航。
- **Do** 用语义颜色同步页面、词义抽屉、导航栏和底部标签栏；保存用户主题偏好。
- **Do** 保留输入与资料，并在错误附近说明重试方法；未登录、空资料库、断网、过期会话和配额不足均有明确状态。
- **Do** 保持触控按钮至少 88rpx，在真实设备上核验 44 逻辑像素的触控目标。
- **Do** 让中英文目标词同时使用词汇前景色；检查深色高亮可读性。
- **Do** 使用纸白导出、英文衬线段落、较弱的中文翻译和三列词汇表。

### Don't:

- **Don't** 另创品牌或为六套主题改变内容与交互层级。
- **Don't** 增加独立的拼写检查按钮；更正与补全属于输入编辑器。
- **Don't** 将深色或其他阅读主题传入打印导出。
- **Don't** 展示编造的学习统计、评价、模型进度或付费入口。
- **Don't** 让错误清空输入与本地资料。
