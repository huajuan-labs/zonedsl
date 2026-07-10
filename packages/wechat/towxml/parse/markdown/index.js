// v2.8: 移除 hljs 语法高亮 —— 项目场景以 markdown 内容为主,代码块极少出现,
// 保留 hljs 会占 132KB 分包体积得不偿失.代码块降级为纯文本渲染(黑底浅字,无高亮).
// 如果未来需要重新启用,参考 参考/towxml/parse/markdown/index.js 里的实现.

const md = require('./markdown')({
    html: true,
    xhtmlOut: true,
    typographer: true,
    breaks: true,
});

// 注册 markdown 扩展插件(sub/sup/ins/mark/emoji/todo/echarts)
md.use(require('./plugins/sub'));
md.use(require('./plugins/sup'));
md.use(require('./plugins/ins'));
md.use(require('./plugins/mark'));
md.use(require('./plugins/emoji'));
md.use(require('./plugins/todo'));
md.use(require('./plugins/echarts'));

// emoji 渲染规则
md.renderer.rules.emoji = (token, index) => {
    const item = token[index];
    return `<g-emoji class="h2w__emoji h2w__emoji--${item.markup}">${item.content}</g-emoji>`;
};

// 导出模块
module.exports = str => {
    return md.render(str);
};
