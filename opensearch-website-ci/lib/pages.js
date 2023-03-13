const path = require('path');
const fs = require('fs-extra');
const matter = require('gray-matter');
const handlebars = require("./handlebars");
const Task = require("./task");

const SUPPORTED_LANGS = require('../config/langs.json');
const LANGUAGES = Object.keys(SUPPORTED_LANGS);

class Pages extends Task {
    _sourceDir;
    _contentDirs = {};
    _partialsDirs = {};
    _defaultsHTMLs = {};
    _data = {};
    _i18n = {};

    async build() {
        await super.build();

        try {
            this._sourceDir = path.join(this.rootDir, 'pages');

            for (let lang of LANGUAGES) {
                this._defaultsHTMLs[lang] = (await fs.readFile(path.join(this.destinationDir, lang === 'en' ? '.' : lang, 'default.html'))).toString();
                this._partialsDirs[lang] = `assets/pages/${lang}`;
                this._contentDirs[lang] = lang === 'en' ? '.' : lang;
                this._i18n[lang] = await fs.readJSON(path.join(this.destinationDir, 'assets/i18n', `${lang}.json`));
            }

            this._data = await fs.readJSON(path.join(this.destinationDir, 'data/data.json'));

            await this._walk(this._sourceDir);
        } catch (e) {
            console.error(e);
        }

        await super.done();
    }

    async _compile(loc) {
        const _loc = path.relative(this._sourceDir, loc);
        let [lang, root, ...rest] = _loc.split('/');

        let {content, data: page} = matter((await fs.readFile(loc)).toString());
        const pageData = {page, data: this._data, ...this._i18n[lang], 'default-page-suffix': this._i18n[lang].default.page.title};
        const metaTitle = `<meta name="opensearch:title" content="${pageData.page.title ? pageData.page.title + ' · ' : ''}${pageData['default-page-suffix']}">`;
        let html = handlebars.render(content, pageData);

        if (root === 'index.html') root = '';
        if (rest[rest.length - 1] === 'index.html') rest.pop();
        const _path = [...rest].join('/');

        if (rest.length === 0) rest.push('index.html');

        await fs.outputFile(path.join(this.destinationDir, this._partialsDirs[lang], root, ...rest), html + metaTitle);

        html = handlebars.render(this._defaultsHTMLs[lang], pageData)
            .replace(/(<html)/, `$1 data-path="${[root, _path].join('/').replace(/^\/+/, '')}"`)
            .replace(/(<main-header)/, `$1 data-root="${root}"`)
            .replace(/(<body-router)/, `$1 data-root="${root}" data-path="${_path}"`)
            .replace(/(<body-router.*?>)/, `$1\r${html}\r`);

        await fs.outputFile(path.join(this.destinationDir, this._contentDirs[lang], root, ...rest), html);
    }

    async _walk(loc) {
        const files = await fs.readdir(loc);

        for (let file of files) {
            const _loc = path.join(loc, file);
            const stat = await fs.lstat(_loc);

            if (stat.isDirectory()) {
                await this._walk(_loc);
            } else if (stat.isFile()) {
                await this._compile(_loc);
            }
        }
    }

    async watch() {
        (await super.watch({
            paths: '**/*',
            cwd: 'pages',
            excludes: ['**/events/default.html']
        }))
            .on('all', async (e, loc) => {
                console.log(`\n${(new Date()).toLocaleTimeString('en-US')} -> Changed ./pages/${loc}`);
                await this.build();
            });
    }
}

module.exports = new Pages();