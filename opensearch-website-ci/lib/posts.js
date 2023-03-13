const path = require('path');
const fs = require('fs-extra');
const handlebars = require("./handlebars");
const Task = require("./task");

const SUPPORTED_LANGS = require('../config/langs.json');
const LANGUAGES = Object.keys(SUPPORTED_LANGS);

const dateFormatter = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: 'numeric', hour12: false });

class Posts extends Task {
    _contentDirs = {};
    _partialsDirs = {};
    _defaultsHTMLs = {};
    _defaultsTemplates = {};
    _data = {};
    _i18n = {};

    df = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });

    async build() {
        await super.build();

        this._data = await fs.readJSON(path.join(this.destinationDir, 'data/data.json'));
        this._posts = await fs.readJSON(path.join(this.destinationDir, 'data/posts.json'));

        await this._buildNews();
        await this._buildPosts();

        await super.done();
    }

    async _buildNews() {
        await super.build('News');

        try {
            for (let lang of LANGUAGES) {
                const file = path.join(this.rootDir, 'pages', lang, 'news/default.html');
                try {
                    fs.accessSync(file, fs.constants.R_OK);
                } catch (ex) {
                    continue;
                }

                this._defaultsHTMLs[lang] = (await fs.readFile(path.join(this.destinationDir, lang === 'en' ? '.' : lang, 'default.html'))).toString();
                this._defaultsTemplates[lang] = (await fs.readFile(path.join(this.rootDir, 'pages', lang, 'news/default.html'))).toString();
                this._partialsDirs[lang] = `assets/pages/${lang}`;
                this._contentDirs[lang] = lang === 'en' ? '.' : lang;
                this._i18n[lang] = await fs.readJSON(path.join(this.destinationDir, 'assets/i18n', `${lang}.json`));

                await this._compileNews(lang);
            }
        } catch (e) {
            console.error(e);
        }

        await super.done('News');
    }

    async _buildPosts() {
        await super.build('Posts');

        await super.done('Posts');
    }

    async _compileNews(lang) {
        for (let i = 0, len = this._posts.length; i < len; i+= 5) {
            const list = this._posts.slice(i, i + 5)
                .map(post => {
                    const content = post.content.replace(/\s*[\s\r\n]+\s*/g, ' ')
                        .replace(/\s*<\/?[a-z][a-z0-9]*\b.*?>\s*/gi, ' ')
                        .replace(/\s{2,}/g, ' ');

                    let summary;

                    if (content.length > maxLength) {
                        summary = content.match(new RegExp(`^(.{0,${maxLength}})[.\\s,:;!?)]`))?.[1];
                        if (summary) {
                            summary = summary + '&nbsp;&hellip;';
                        } else {
                            summary = content.substr(0, maxLength) + '&nbsp;&hellip;';
                        }
                    }

                    const dt = new Date(`${post.data.date}-0700`);

                    return `
                        <li>
                            <a href="${this._i18n[lang].lang['url-prefix']}/blog/${post.category}/${post.key}.html">${post.data.title}</a>
                            <small>${this.df.format(dt)}</small>
                            <p>${summary}</p>
                            <read-more href="${this._i18n[lang].lang['url-prefix']}/blog/${post.category}/${post.key}.html"></read-more>
                        </li>
                    `;
                });
            const pageData = {page: {...event, title: event.data.title}, data: this._data, ...this._i18n[lang], 'default-page-suffix': this._i18n[lang].default.page.title};
        }
        const metaTitle = `<meta name="opensearch:title" content="${pageData.page.title ? pageData.page.title + ' · ' : ''}${pageData['default-page-suffix']}">`;
        let html = handlebars.render(this._defaultsTemplates[lang], pageData);

        await fs.outputFile(path.join(this.destinationDir, this._partialsDirs[lang], 'events', `${event.key}.html`), html + metaTitle);

        html = handlebars.render(this._defaultsHTMLs[lang], pageData)
            .replace(/(<html)/, `$1 data-path="events/${event.key}.html"`)
            .replace(/(<main-header)/, `$1 data-root="events"`)
            .replace(/(<body-router)/, `$1 data-root="events" data-path="${event.key}.html"`)
            .replace(/(<body-router.*?>)/, `$1\r${html}\r`);

        await fs.outputFile(path.join(this.destinationDir, this._contentDirs[lang], 'events', `${event.key}.html`), html);
    }

    async watch() {
        (await super.watch({
            paths: '**/events/default.html',
            cwd: 'pages',
        }))
            .on('all', async (e, loc) => {
                console.log(`\n${(new Date()).toLocaleTimeString('en-US')} -> Changed ./pages/${loc}`);
                await this.build();
            });
    }
}

module.exports = new Posts();