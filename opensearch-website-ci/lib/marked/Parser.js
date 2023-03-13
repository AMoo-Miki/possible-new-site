const marked = require('marked');
const hljs = require('highlight.js');
const Renderer = marked.Renderer;
const TextRenderer = marked.TextRenderer;
const Slugger = marked.Slugger;
const defaults = {
    ...marked.getDefaults(),
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    }
};

Renderer.prototype.table = (header, body) => {
    if (header) header = '<thead>' + header + '</thead>';
    if (body) body = '<tbody>' + body + '</tbody>';

    return `<div class="table-wrapper"><table>${header}${body}</table></div>`;
}

// Marked helpers
const unescapeTest = /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig;

function unescape(html) {
    // explicitly match decimal, hex, and named HTML entities
    return html.replace(unescapeTest, (_, n) => {
        n = n.toLowerCase();
        if (n === 'colon') return ':';
        if (n.charAt(0) === '#') {
            return n.charAt(1) === 'x'
                ? String.fromCharCode(parseInt(n.substring(2), 16))
                : String.fromCharCode(+n.substring(1));
        }
        return '';
    });
}

// Our stylizing logic
function stylize(text, modifier) {
    if (!modifier) return text;

    // Consider everything a classname but this can be extended later
    const classNames = modifier.replace(/^[\s.]+/, '').replace(/[\s.]+/g, ' ');
    if (/^<.+?\b/.test(text)) {
        return text.replace(/^<.+?\b/, match => {
            return `${match} class="${classNames}"`;
        });
    } else {
        return `<span class="${classNames}">${text}</span>`;
    }
}

/**
 * Parsing & Compiling
 */
class Parser {
    constructor(options) {
        this.options = options || defaults;
        this.options.renderer = this.options.renderer || new Renderer();
        this.renderer = this.options.renderer;
        this.renderer.options = this.options;
        this.textRenderer = new TextRenderer();
        this.slugger = new Slugger();
    }

    /**
     * Static Parse Method
     */
    static parse(tokens, options) {
        const parser = new Parser(options);
        return parser.parse(tokens);
    }

    /**
     * Static Parse Inline Method
     */
    static parseInline(tokens, options) {
        const parser = new Parser(options);
        return parser.parseInline(tokens);
    }

    /**
     * Parse Loop
     */
    parse(tokens, top = true) {
        let out = '',
            i,
            j,
            k,
            l2,
            l3,
            row,
            cell,
            header,
            body,
            token,
            ordered,
            start,
            loose,
            itemBody,
            item,
            checked,
            task,
            checkbox,
            ret;

        const l = tokens.length;
        for (i = 0; i < l; i++) {
            token = tokens[i];

            // Run any renderer extensions
            if (this.options.extensions && this.options.extensions.renderers && this.options.extensions.renderers[token.type]) {
                ret = this.options.extensions.renderers[token.type].call(this, token);
                if (ret !== false || !['space', 'hr', 'heading', 'code', 'table', 'blockquote', 'list', 'html', 'paragraph', 'text'].includes(token.type)) {
                    out += stylize(ret || '', token.modifier);
                    continue;
                }
            }

            switch (token.type) {
                case 'space': {
                    continue;
                }
                case 'hr': {
                    out += stylize(this.renderer.hr(), token.modifier);
                    continue;
                }
                case 'heading': {
                    out += stylize(this.renderer.heading(
                        this.parseInline(token.tokens),
                        token.depth,
                        unescape(this.parseInline(token.tokens, this.textRenderer)),
                        this.slugger), token.modifier);
                    continue;
                }
                case 'code': {
                    out += stylize(this.renderer.code(token.text,
                        token.lang,
                        token.escaped), token.modifier);
                    continue;
                }
                case 'table': {
                    header = '';

                    // header
                    cell = '';
                    l2 = token.header.length;
                    for (j = 0; j < l2; j++) {
                        cell += this.renderer.tablecell(
                            this.parseInline(token.tokens.header[j]),
                            { header: true, align: token.align[j] }
                        );
                    }
                    header += this.renderer.tablerow(cell);

                    body = '';
                    l2 = token.cells.length;
                    for (j = 0; j < l2; j++) {
                        row = token.tokens.cells[j];

                        cell = '';
                        l3 = row.length;
                        for (k = 0; k < l3; k++) {
                            cell += this.renderer.tablecell(
                                this.parseInline(row[k]),
                                { header: false, align: token.align[k] }
                            );
                        }

                        body += this.renderer.tablerow(cell);
                    }
                    out += stylize(this.renderer.table(header, body), token.modifier);
                    continue;
                }
                case 'blockquote': {
                    body = this.parse(token.tokens);
                    out += stylize(this.renderer.blockquote(body), token.modifier);
                    continue;
                }
                case 'list': {
                    ordered = token.ordered;
                    start = token.start;
                    loose = token.loose;
                    l2 = token.items.length;

                    body = '';
                    for (j = 0; j < l2; j++) {
                        item = token.items[j];
                        checked = item.checked;
                        task = item.task;

                        itemBody = '';
                        if (item.task) {
                            checkbox = this.renderer.checkbox(checked);
                            if (loose) {
                                if (item.tokens.length > 0 && item.tokens[0].type === 'text') {
                                    item.tokens[0].text = checkbox + ' ' + item.tokens[0].text;
                                    if (item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && item.tokens[0].tokens[0].type === 'text') {
                                        item.tokens[0].tokens[0].text = checkbox + ' ' + item.tokens[0].tokens[0].text;
                                    }
                                } else {
                                    item.tokens.unshift({
                                        type: 'text',
                                        text: checkbox
                                    });
                                }
                            } else {
                                itemBody += checkbox;
                            }
                        }

                        itemBody += this.parse(item.tokens, loose);
                        body += this.renderer.listitem(itemBody, task, checked);
                    }

                    out += stylize(this.renderer.list(body, ordered, start), token.modifier);
                    continue;
                }
                case 'html': {
                    // TODO parse inline content if parameter markdown=1
                    out += stylize(this.renderer.html(token.text), token.modifier);
                    continue;
                }
                case 'paragraph': {
                    out += stylize(this.renderer.paragraph(this.parseInline(token.tokens)), token.modifier);
                    continue;
                }
                case 'text': {
                    body = token.tokens ? this.parseInline(token.tokens) : token.text;
                    while (i + 1 < l && tokens[i + 1].type === 'text') {
                        token = tokens[++i];
                        body += '\n' + (token.tokens ? this.parseInline(token.tokens) : token.text);
                    }
                    out += stylize(top ? this.renderer.paragraph(body) : body, token.modifier);
                    continue;
                }

                default: {
                    const errMsg = 'Token with "' + token.type + '" type was not found.';
                    if (this.options.silent) {
                        console.error(errMsg);
                        return;
                    } else {
                        throw new Error(errMsg);
                    }
                }
            }
        }

        return out;
    }

    /**
     * Parse Inline Tokens
     */
    parseInline(tokens, renderer) {
        renderer = renderer || this.renderer;
        let out = '',
            i,
            token,
            ret;

        const l = tokens.length;
        for (i = 0; i < l; i++) {
            token = tokens[i];

            // Run any renderer extensions
            if (this.options.extensions && this.options.extensions.renderers && this.options.extensions.renderers[token.type]) {
                ret = this.options.extensions.renderers[token.type].call(this, token);
                if (ret !== false || !['escape', 'html', 'link', 'image', 'strong', 'em', 'codespan', 'br', 'del', 'text'].includes(token.type)) {
                    out += stylize(ret || '', token.modifier);
                    continue;
                }
            }

            switch (token.type) {
                case 'escape': {
                    out += stylize(renderer.text(token.text), token.modifier);
                    break;
                }
                case 'html': {
                    out += stylize(renderer.html(token.text), token.modifier);
                    break;
                }
                case 'link': {
                    out += stylize(renderer.link(token.href, token.title, this.parseInline(token.tokens, renderer)), token.modifier);
                    break;
                }
                case 'image': {
                    out += stylize(renderer.image(token.href, token.title, token.text), token.modifier);
                    break;
                }
                case 'strong': {
                    out += stylize(renderer.strong(this.parseInline(token.tokens, renderer)), token.modifier);
                    break;
                }
                case 'em': {
                    out += stylize(renderer.em(this.parseInline(token.tokens, renderer)), token.modifier);
                    break;
                }
                case 'codespan': {
                    out += stylize(renderer.codespan(token.text), token.modifier);
                    break;
                }
                case 'br': {
                    out += stylize(renderer.br(), token.modifier);
                    break;
                }
                case 'del': {
                    out += stylize(renderer.del(this.parseInline(token.tokens, renderer)), token.modifier);
                    break;
                }
                case 'text': {
                    out += stylize(renderer.text(token.text), token.modifier);
                    break;
                }
                default: {
                    const errMsg = 'Token with "' + token.type + '" type was not found.';
                    if (this.options.silent) {
                        console.error(errMsg);
                        return;
                    } else {
                        throw new Error(errMsg);
                    }
                }
            }
        }
        return out;
    }
}

module.exports = {
    Parser,
    defaults
};
