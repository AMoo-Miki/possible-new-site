const marked = require('marked');
const {Parser, defaults} = require('./Parser');

const inlineModifier = {
    name: 'inlineModifier',
    level: 'inline',
    start(src) {
        return src.match(/{:/)?.index;
    },
    tokenizer(src) {
        const rule = /^{:((?:\s+\.[^\s]+)+)\s*}/;
        const match = rule.exec(src);
        if (match) {
            return {
                type: 'inlineModifier',
                raw: match[0],
                modifier: match[1]
            };
        }
    },
    renderer() {
        return '';
    },
    childTokens: ['modifier'],
};

const blockModifier = {
    name: 'blockModifier',
    level: 'block',
    start(src) {
        return src.match(/[\r\n]{:/)?.index;
    },
    tokenizer(src) {
        const rule = /^{:((?:\s+\.[^\s]+)+)\s*}/;
        const match = rule.exec(src);
        if (match) {
            return {
                type: 'blockModifier',
                raw: match[0],
                modifier: match[1]
            };
        }
    },
    renderer() {
        return '';
    },
    childTokens: ['modifier'],
};

marked.use({extensions: [inlineModifier, blockModifier]});

const getPhrases = o => {
    const phrases = new Map();
    const _serialize = (o, prefix = '') => {
        switch (o?.constructor.name) {
            case 'Array':
                for (let i = 0, len = o.length; i < len; i++)
                    _serialize(o[i], `${prefix}${prefix ? '.' : ''}${i}`);
                break;

            case 'Object':
                const keys = Object.keys(o);
                let i = keys.length;
                while (i--) {
                    _serialize(o[keys[i]], `${prefix}${prefix ? '.' : ''}${keys[i]}`);
                }
                break;

            case "String":
            case "Number":
                phrases.set(prefix, o);
                break;

            case "Boolean":
                phrases.set(prefix, o ? 'true' : 'false');
                break;

            default:
                console.warn(`${prefix} has a non-string value (${o?.constructor.name}).`);
        }
    };

    _serialize(o);

    return phrases;
};

const mergeModifiers = items => {
    for (let i = 0, blockLength = items.length; i < blockLength; i++) {
        if (!items[i]) continue;
        const item = items[i];

        if (Array.isArray(item.tokens)) {
            for (let j = 1, inlineLength = item.tokens.length; j < inlineLength; j++) {
                if (item.tokens[j]?.type === 'inlineModifier') {
                    if (item.tokens[j].modifier && item.tokens[j - 1]) {
                        item.tokens[j - 1].modifier = (item.tokens[j - 1].modifier || '') + ' ' + item.tokens[j].modifier;
                    }
                    item.tokens.splice(j, 1);
                    j--;
                    inlineLength--;
                }
            }
        }

        if (item.modifier && item.type === 'blockModifier') {
            if (items[i - 1]) {
                items[i - 1].modifier = (items[i - 1].modifier || '') + ' ' + item.modifier;
            }
            items.splice(i, 1);
            i--;
            blockLength--;
        }

        if (Array.isArray(item.items)) {
            item.items.forEach(({tokens}) => {
                if (tokens) mergeModifiers(tokens);
            });
        }
    }

    return items;
}


const render = (input, data) => {
    const _phrases = getPhrases(data);

    let text = input;
    while (true) {
        let unchanged = true;
        text = text.replace(/{{\s*([^\s#$!@%)(]+?)\s*}}/g, (m, m1) => {
            unchanged = false;
            return _phrases.has(m1) ? _phrases.get(m1) : m1;
        });
        if (unchanged) break;
    }

    const items = marked.lexer(text);

    const tokens = mergeModifiers(items);

    //console.log('B', JSON.stringify(tokens));

    return Parser.parse(tokens);
};

module.exports = {
    render
}