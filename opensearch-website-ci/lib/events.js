const path = require('path');
const fs = require('fs-extra');
const handlebars = require("./handlebars");
const Task = require("./task");

const SUPPORTED_LANGS = require('../config/langs.json');
const LANGUAGES = Object.keys(SUPPORTED_LANGS);

const dateFormatter = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: 'numeric', hour12: false });

class Events extends Task {
    _contentDirs = {};
    _partialsDirs = {};
    _defaultsHTMLs = {};
    _defaultsTemplates = {};
    _data = {};
    _i18n = {};

    async build() {
        await super.build();

        try {
            this._data = await fs.readJSON(path.join(this.destinationDir, 'data/data.json'));
            const events = await fs.readJSON(path.join(this.destinationDir, 'data/events.json'));

            for (let lang of LANGUAGES) {
                const file = path.join(this.rootDir, 'pages', lang, 'events/default.html');
                try {
                    fs.accessSync(file, fs.constants.R_OK);
                } catch (ex) {
                    continue;
                }

                this._defaultsHTMLs[lang] = (await fs.readFile(path.join(this.destinationDir, lang === 'en' ? '.' : lang, 'default.html'))).toString();
                this._defaultsTemplates[lang] = (await fs.readFile(path.join(this.rootDir, 'pages', lang, 'events/default.html'))).toString();
                this._partialsDirs[lang] = `assets/pages/${lang}`;
                this._contentDirs[lang] = lang === 'en' ? '.' : lang;
                this._i18n[lang] = await fs.readJSON(path.join(this.destinationDir, 'assets/i18n', `${lang}.json`));

                for (let event of events) await this._compile(event, lang);
            }
        } catch (e) {
            console.error(e);
        }

        await super.done();
    }

    async _compile(event, lang) {
        if (!event?.data?.eventdate) {
            throw 'Missing "eventdate" from event data';
        }

        const dt = new Date(`${event.data.eventdate}-0700`);
        const pageData = {page: {...event, title: event.data.title, 'event-date': dateFormatter.format(dt), 'event-time': timeFormatter.format(dt)}, data: this._data, ...this._i18n[lang], 'default-page-suffix': this._i18n[lang].default.page.title};
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

module.exports = new Events();