# Chart 层组件速查

图表层 — echarts 驱动的数据可视化组件。

## line — 折线图

```
::line "月度营收趋势" subtitle="单位 万元" labels=1月,2月,3月,4月,5月,6月 data=820,1050,880,1180,1240,1400 area smooth unit=万
```

属性：
- `labels`：x 轴标签，逗号分隔
- `data`：数值，逗号分隔
- `area`：填充区域
- `smooth`：平滑曲线
- `unit`：单位（显示在 tooltip）
- `subtitle`：副标题
- `color`：自定义颜色

## bar — 柱状图

```
::bar "各品类营收" labels=服装,食品,数码,家电,美妆 data=380,220,510,290,180
```

## pie — 饼图

```
::pie "流量来源占比" labels=自然搜索,广告投放,社交媒体,直接访问 data=45,28,17,10
::pie "占比" data=45,30,25 labels=电商,私域,线下 donut unit=%
```

`donut`：环形图；`unit`：单位

也支持 `series` 子组件指定每段：
```
::pie "销量"
  series "苹果" value=3200
  series "三星" value=2400
```

## sparkline — 迷你趋势图

```
::sparkline data=1,3,2,5,4,7,6,8 color=accent
```

无轴无标签，适合行内嵌入

## radar — 雷达图

```
::radar "综合能力" indicator=技术,设计,沟通,创新,执行 value=90,80,85,70,88
```

`indicator`：维度名；`value`：对应数值；`max`：最大值（默认 100）

## ring — 环形进度

```
::ring value=75 color=accent desc="项目完成度"
::ring value=42 color=success desc="季度目标"
```

`value`：0-100

## rank — 排行榜

```
::rank "TOP 5 品牌"
  item "苹果" value=3200
  item "三星" value=2400
  item "小米" value=1800
```

自动计算进度条，前三名金银铜配色

别名：`::ranking`

## compare — 数值对比

```
::compare "版本升级对比"
  item "旧版 V1.0" value=100 desc="基础功能"
  item "新版 V2.0" value=180 desc="全面升级"
```

## 高级：option yaml 覆盖

任何图表都支持 `option` 子节点用极简 YAML 覆盖 echarts option：

```
::line "自定义" labels=A,B,C data=1,2,3
  option
    yAxis.0.max: 10
    series.0.itemStyle.color: "#FF0000"
```

支持点号深路径赋值
