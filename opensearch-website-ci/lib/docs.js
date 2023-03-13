const path = require('path');
const fs = require('fs-extra');
const matter = require('gray-matter');
const marked = require('./marked');
const handlebars = require("./handlebars");
const Task = require("./task");

const SUPPORTED_LANGS = require('../config/langs.json');
const LANGUAGES = Object.keys(SUPPORTED_LANGS);

class Docs extends Task {
    _sourceDir;
    _contentDirs = {};
    _partialsDirs = {};
    _defaultsHTMLs = {};
    _data = {};
    _i18n = {};
    _nav = {};

    async build() {
        await super.build();

        try {
            this._sourceDir = path.join(this.rootDir, 'docs');

            for (let lang of LANGUAGES) {
                this._defaultsHTMLs[lang] = (await fs.readFile(path.join(this.destinationDir, lang === 'en' ? '.' : lang, 'default.html'))).toString();
                this._partialsDirs[lang] = `assets/pages/${lang}/docs`;
                this._contentDirs[lang] = lang === 'en' ? 'docs' :`${lang}/docs`;
                this._i18n[lang] = await fs.readJSON(path.join(this.destinationDir, 'assets/i18n', `${lang}.json`));
            }

            this._data = await fs.readJSON(path.join(this.destinationDir, 'data/data.json'));

            const langs = await fs.readdir(this._sourceDir);
            for (let lang of langs) {
                const _loc = path.join(this._sourceDir, lang);
                const stat = await fs.lstat(_loc);

                await fs.emptyDir(path.join(this.destinationDir, this._partialsDirs[lang]));

                if (stat.isDirectory()) {
                    await this._generateNav(_loc, lang);
                    await this._walk(_loc, async loc => {
                        await this._compile(loc, lang);
                    });
                }
            }
        } catch (e) {
            console.error(e);
        }

        await super.done();
    }

    async _generateNav(loc, lang) {
        const rootLength = loc.length;
        const list = await this._walk(loc, async loc => {
            let {data: {nav_order, title}} = matter((await fs.readFile(loc)).toString());
            return {loc, order: nav_order, title, leaf: true};
        });

        const rollup = (parent, hierarchy = [], depth = 0) => {
            if (!parent.children?.length) return;

            const rel = parent.loc.substr(rootLength).replace(/([\/\\])@/, '$1').split(/[\/\\]+/g).join('/').replace(/^\/+/, '');

            if (depth > 1 && !parent.title) {
                for (let i = 0, len = parent.children.length; i < len; i++) {
                    if (/\/index\.md$/.test(parent.children[i].loc)) {
                        parent.rel = rel ? `${rel}/`: '';
                        parent.hierarchy = [...hierarchy];

                        if (/\/@[^\/]+$/.test(parent.loc)) {
                            parent.title = path.basename(parent.loc).replace(/^@/, '');
                        } else {
                            parent.title = parent.children[i].title;
                            parent.order = parent.children[i].order;
                        }
                        parent.children.splice(i, 1);
                        break;
                    }
                }

                // No landing page found; look for versioned elements
                if (!parent.title) {
                    parent.children.sort((a, b) => b.loc.localeCompare(a.loc));

                    out:
                    for (let i = 0, len = parent.children.length; i < len; i++) {
                        if (!/\/@[^\/]+$/.test(parent.children[i].loc)) continue;

                        for (let j = 0, clen = parent.children[i].children.length; j < clen; j++) {
                            if (/\/index\.md$/.test(parent.children[i].children[j].loc)) {
                                parent.title = parent.children[i].children[j].title;
                                parent.order = parent.children[i].children[j].order;
                                break out;
                            }
                        }
                    }
                }
            } else if (depth === 1) {
                const meta = this._i18n[lang].doc?.folder?.[rel];
                if (!meta) throw `Missing translation for doc.folder.${rel} in ${lang}.`;

                parent.title = meta.label;
                parent.order = meta.order;
            }

            let leafHierarchy;
            if (depth < 1) {
                leafHierarchy = [];
            } else {
                leafHierarchy = [...hierarchy, {title: parent.title, rel: parent.rel}];
            }

            for (let child of parent.children) {
                if (/\.md$/.test(child.loc)) {
                    const filename = path.parse(child.loc).name;
                    child.rel = (rel ? `${rel}/`: '') + (filename === 'index' ? (rel ? '' : '/') : `${filename}.html`);
                    child.hierarchy = leafHierarchy;
                    delete child.leaf;
                } else if (!child.leaf) {
                    rollup(child, leafHierarchy, depth + 1);
                } else {
                    throw `Unknown leaf file: ${child.loc}`;
                }
            }
        };

        rollup(list);

        const getCleanHierarchy = (children, depth = 0) => {
            const result = [];
            children.sort((a, b) => a.order - b.order);
            for (let child of children) {
                const item = {
                    title: child.title,
                    rel: child.rel,
                };

                if (child.children?.length) item.children = getCleanHierarchy(child.children);

                result.push(item);
            }

            return result;
        };

        const hierarchy = getCleanHierarchy(list.children);
        await fs.outputJSON(path.join(this.destinationDir, this._partialsDirs[lang], 'nav.json'), hierarchy);

        this._nav[lang] = {list: list.children};
    }

    async _compile(loc, lang) {
        const _loc = path.relative(path.join(this._sourceDir, lang), path.dirname(loc)).replace(/([\/\\])@/g, '$1');
        const filename = path.parse(loc).name;
        let _path = path.join(_loc, !filename || filename === 'index' ? '/' : `${filename}.html`);
        if (_path === '.') _path = '';

        let {content, data: page} = matter((await fs.readFile(loc)).toString());
        const pageData = {page, data: this._data, ...this._i18n[lang], 'default-page-suffix': this._i18n[lang].default.docs.title};
        const metaTitle = `<meta name="opensearch:title" content="${pageData.page.title ? pageData.page.title + ' · ' : ''}${pageData['default-page-suffix']}">`;
        content = marked.render(content, pageData);

        content = `<docs-layout data-path="${_path}">\n${content}\n</docs-layout>`;

        await fs.outputFile(path.join(this.destinationDir, this._partialsDirs[lang], _loc, filename + '.html'), content + metaTitle);

        const html = handlebars.render(this._defaultsHTMLs[lang], pageData)
            .replace(/(<html)/, `$1 data-path="${['docs', _path].join('/').replace(/(^\/+|\/+$)/g, '')}"`)
            .replace(/(<main-header)/, `$1 data-root="docs"`)
            .replace(/(<body-router)/, `$1 data-root="docs" data-path="${_path}"`)
            .replace(/(<body-router.*?>)/, `$1\r${content}\r`);

        await fs.outputFile(path.join(this.destinationDir, this._contentDirs[lang], _loc, filename + '.html'), html);
    }

    async _walk(loc, callback) {
        //console.log(`Walking ${loc}`);
        const files = await fs.readdir(loc);
        const result = {loc, children: []};

        for (let file of files) {
            const _loc = path.join(loc, file);
            const stat = await fs.lstat(_loc);

            if (stat.isDirectory()) {
                result.children.push(await this._walk(_loc, callback));
            } else if (stat.isFile()) {
                result.children.push(await callback(_loc));
            }
        }

        return result;
    }

    async watch() {
        (await super.watch({
            paths: '**/*',
            cwd: 'docs'
        }))
            .on('all', async (e, loc) => {
                console.log(`\n${(new Date()).toLocaleTimeString('en-US')} -> Changed ./pages/${loc}`);
                await this.build();
            });
    }
}

module.exports = new Docs();