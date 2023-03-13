const fs = require('fs-extra');
const path = require('path');
const {request, download} = require('../lib/util');

const url = 'https://fonts.googleapis.com/css2?family=Fira+Mono:wght@400;500;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&family=Open+Sans+Condensed:ital,wght@0,300;0,700;1,300&family=Open+Sans:ital,wght@0,300;0,400;0,600;0,700;0,800;1,300;1,400;1,600;1,700;1,800';

(async () => {
    const css = await request(url, {method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:77.0) Gecko/20100101 Firefox/77.0' }});

    const fontDir = path.resolve(path.join('.', 'assets', 'font'));

    const list = {};

    const re = /\/\*\s*(.+?)\s*\*\/\s*[\r\n]+\s*@font-face\s*{\s*[\r\n]+\s*([\s\S]+?)\s*[\r\n]+\s*}/mg
    let match;
    while (match = re.exec(css.body)) {
        const o = {charset: match[1]};
        let m;
        if (m = match[2].match(/font-family\s*:[\s'"]*(.+?)[\s'"]*;/)) {
            o.family = m[1];
            o.dir = o.family.toLowerCase().replace(/[\s-_]+/g, '-');
        }
        if (m = match[2].match(/font-style\s*:\s*(.+?)\s*;/)) o.style = m[1];
        if (m = match[2].match(/font-weight\s*:\s*(.+?)\s*;/)) o.weight = m[1];
        if (m = match[2].match(/unicode-range\s*:\s*(.+?)\s*;/)) o.range = m[1];
        if (m = match[2].match(/src\s*:\s*url\([\s'"]*(.+?\.woff2)[\s'"]*\)/)) o.src = m[1];
        if (m = o.src?.match(/\/s\/(.+?)\/v(\d+)\//)) {
            o.name = `${m[1]}-${o.charset}-${o.style}-${o.weight}-v${m[2]}.woff2`;
        } else {
            o.name = `${o.family.toLowerCase().replace(/[\s-_]+/g, '')}-${o.charset}-${o.style}-${o.weight}.woff2`;
        }

        if (!list[o.dir]) {
            list[o.dir] = [];
            await fs.emptyDir(path.join(fontDir, o.dir));
        }
        list[o.dir].push(
            '/* ' + o.charset + ' */\n' +
            '@font-face {\n' +
            '  font-family: \'' + o.family + '\';\n' +
            '  font-style: ' + o.style + ';\n' +
            '  font-weight: ' + o.weight + ';\n' +
            '  src: url(\'' + o.name + '\') format(\'woff2\');\n' +
            '  unicode-range: ' + o.range + ';\n' +
            '}'
        );

        console.log(`Downloading ${o.src}`);
        await download(o.src, path.join(fontDir, o.dir, o.name));
    }

    const keys = Object.keys(list);
    for (let key of keys) {
        await fs.outputFile(path.join(fontDir, key, 'webfont.css'), list[key].join('\n'));
    }
})();