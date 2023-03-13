const marked = require('marked');
const util = require('util');
const Parser = require("./lib/marked/Parser");

const text = `
# head
A [Get started](#docker-quickstart){: .btn .btn-blue } B{: .bbb }
{: .head2 }
`;

const inlineModifier = {
    name: 'inlineModifier',
    level: 'inline',                                 // Is this a block-level or inline-level tokenizer?
    start(src) { return src.match(/{:/)?.index; },    // Hint to Marked.js to stop and check for a match
    tokenizer(src, tokens) {
        const rule = /^{:((?:\s+\.[^\s]+)+)\s*}/;  // Regex for the complete token
        const match = rule.exec(src);
        if (match) {
            return {                                     // Token to generate
                type: 'inlineModifier',                         // Should match "name" above
                raw: match[0],                             // Text to consume from the source
                modifier: this.inlineTokens(match[1]),    // Additional custom properties
            };
        }
    },
    renderer(token) {
        return '';
    },
    childTokens: ['modifier'],
};

const blockModifier = {
    name: 'blockModifier',
    level: 'block',                                 // Is this a block-level or inline-level tokenizer?
    start(src) { return src.match(/[\r\n]{:/)?.index; },    // Hint to Marked.js to stop and check for a match
    tokenizer(src, tokens) {
        const rule = /^{:((?:\s+\.[^\s]+)+)\s*}/;  // Regex for the complete token
        const match = rule.exec(src);
        if (match) {
            return {                                     // Token to generate
                type: 'blockModifier',                         // Should match "name" above
                raw: match[0],                             // Text to consume from the source
                modifier: this.inlineTokens(match[1]),    // Additional custom properties
            };
        }
    },
    renderer(token) {
        return '';
    },
    childTokens: ['modifier'],
};

marked.use({ extensions: [inlineModifier, blockModifier] });

const tokens = marked.lexer(text);
for (let i = 0, blockLength = tokens.length; i < blockLength; i++) {
    for (let j = 0, inlineLength = tokens[i]?.tokens?.length; j < inlineLength; j++) {
        if (tokens[i].tokens[j]?.type === 'styling') {
            if (tokens[i].tokens[j - 1]) {
                tokens[i].tokens[j - 1].modifier = (tokens[i].tokens[j - 1].modifier || '') + ' ' + tokens[i].tokens[j].modifier?.[0]?.text;
            }
            tokens[i].tokens.splice(j, 1);
            j--;
            inlineLength--;
        }
    }

    if (tokens[i].type === 'blockModifier') {
        if (tokens[i - 1]) {
            tokens[i - 1].modifier = (tokens[i - 1].modifier || '') + ' ' + tokens[i].modifier?.[0]?.text;
        }
        tokens.splice(i, 1);
        i--;
        blockLength--;
    }
}


const html = Parser.parse(tokens, {});
//process.exit();
console.log(html);

console.log('--------');

console.log(marked(text));