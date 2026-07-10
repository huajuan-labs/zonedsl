// v2.8: 精简配置(移除 hljs / latex / yuml).
// 只保留 decode.js / parse/index.js / img.js 实际读取的字段:
// - markdown: 只作参考,parse/markdown/index.js 里已硬编码 md.use(...)
// - wxml: 原生标签白名单(parse/index.js 里判断是否透传)
// - components: 自定义组件白名单(decode.wxml 里派发)
// - attrs: 保留元素属性白名单
// - bindType / events: 事件绑定方式
// - dpr: 图片倍数(img.js / echarts 用)
module.exports = {
    // markdown 扩展(parse/markdown/index.js 里已硬编码 md.use,此处仅作说明)
    markdown: [
        'sub',
        'sup',
        'ins',
        'mark',
        'emoji',
        'todo',
        'echarts',
    ],

    // wxml 原生标签,不做转换
    wxml: [
        'view',
        'video',
        'text',
        'image',
        'navigator',
        'swiper',
        'swiper-item',
        'scroll-view',
        'block',
        'form',
        'input',
        'textarea',
        'button',
        'checkbox-group',
        'checkbox',
        'radio-group',
        'radio',
        'rich-text',
    ],

    // 自定义组件(decode.wxml 里通过 wx:if 派发)
    components: [
        'echarts',
        'table',
        'img',
    ],

    // 保留的原始属性
    attrs: [
        'class',
        'data',
        'id',
        'style',
    ],

    // 事件绑定方式:catch 会阻止冒泡
    bindType: 'catch',

    // 需要激活的事件
    events: [
        'tap',
        'change',
    ],

    // 图片倍数
    dpr: 1,
}
