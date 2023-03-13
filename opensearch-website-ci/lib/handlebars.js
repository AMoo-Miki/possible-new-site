const Handlebars = require('handlebars');
const cache = new Map();

Handlebars.helpers.truncate = (str, length) => {
    if (typeof str !== 'string') return;

    if (str.length <= length) return str;

    let output = str.match(new RegExp(`^(.{0,${length}})[.\\s,:;!?)]`))?.[1];

    if (output) return output + '&nbsp;&hellip;';
    return str.substr(0, length) + '&nbsp;&hellip;';
}

Handlebars.helpers.strip = str => {
    if (typeof str !== 'string') return;

    return str.replace(/\s*[\s\r\n]+\s*/g, ' ')
        .replace(/\s*<\/?[a-z][a-z0-9]*\b.*?>\s*/gi, ' ')
        .replace(/\s{2,}/g, ' ');
};

Handlebars.helpers['short-circuit'] = (...items) => {
    const opts = items.pop();
    for (let item of items) {
        if (!Handlebars.Utils.isEmpty(item)) return item;
    }

    return undefined;
}

module.exports = {
    render(template, data) {
        let tpl;

        if (cache.has(template)) {
            tpl = cache.get(template);
        } else {
            tpl = Handlebars.compile(template);
            cache.set(template, tpl);
        }

        return tpl(data);
    }
}