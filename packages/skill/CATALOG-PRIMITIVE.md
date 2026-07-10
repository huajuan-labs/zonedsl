# Primitive 层组件速查

原语层 — 无状态、无场景的最小视觉单元。任何主题下都能用。

## text — 正文文字

```
::text "正文内容" size=xs/sm/base/lg/xl
```

支持行内 markdown：`**bold**` / `*italic*` / `` `code` ``

## tag — 标签

```
::tag "热门" color=accent
```

`color` 选项：`accent / primary / success / warning / danger / info / neutral`

## divider — 分隔线

```
::divider
```

## spacer — 留白（v2.3）

```
::spacer h=md           # 5 档预设:xs(8rpx) / sm(16rpx) / md(32rpx) / lg(60rpx) / xl(96rpx)
::spacer h=48           # 精确数字(默认 rpx)
::spacer h=48rpx        # 完整单位
```

用途：段落间需要显式留白时用（比 `\n` 空行更精确）。避免用空白 `::text` 硬撑。

**推荐用法**：
- 连续两个大组件（如两个 `::card`）之间，用 `::spacer h=md`
- 结尾底部与 button 之间，用 `::spacer h=lg`

别名：`::gap`

## badge — 徽章（数字/状态）

```
::badge "3" color=danger
::badge "NEW" color=success
```

## pill — 胶囊标签

```
::pill "热门"
::pill "限时" color=warning
```

## icon — 图标（emoji）

```
::icon "🔥"
::icon "⭐" size=md
```

## avatar — 头像

```
::avatar url="https://..."
::avatar url="..." name="示例艺人甲" size=md
```

`size`：`sm / md / lg`

## quote — 引用

```
::quote "所有伟大的行动和思想,都有一个微不足道的开始。"
::quote "..." cite="加缪"
```

## kicker — 小标题/栏目标签

```
::kicker "本周重磅"
```

## trend — 涨跌指示

```
::trend "↑18%" dir=up
::trend "↓5%" dir=down
```

## tip — 提示条

```
::tip "小贴士:你可以点击图片放大预览" type=info
```

`type`：`info / success / warning / danger / accent`

## callout — 重点信息框

```
::callout "重点信息:请仔细阅读" type=warning
::callout "..." title="注意" type=accent
```

## display — 超大数字展示

```
::display "999+" desc="全球活跃用户"
```

## progress — 进度条

```
::progress value=85 label="产品设计" color=accent
```

`value`：0-100 数字

## alert — 警告条

```
::alert "Q4 是历史最好的一个季度" type=success
```

`type`：`info / success / warn / danger`

## metric — 单值指标卡

```
::metric "1240万" trend="↑18%" desc="Q4 营收" color=accent
```

`color`：`accent / primary / success / warning / danger / info / neutral`

## image — 图片

```
::image url="https://..." caption="雨中的水乡"
::image url="..." mode=widthFix
```

`mode`:image 拉伸模式(参考各端 image 组件)，默认 `widthFix`
