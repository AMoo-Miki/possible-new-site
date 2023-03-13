const path = require('path');
const fs = require('fs-extra');
const Task = require("./task");

const SUPPORTED_LANGS = require('../config/langs.json');
const LANGUAGES = Object.keys(SUPPORTED_LANGS);

class Localization extends Task {
    async build() {
        await super.build();

        try {
            const sourceDir = path.join(this.rootDir, 'i18n');
            const destinationDir = path.join(this.destinationDir, 'assets/i18n');

            const enPhrases = await fs.readJSON(path.join(sourceDir, 'en.json'));

            for (let lang of LANGUAGES) {
                const _loc = path.join(sourceDir, `${lang}.json`);
                let json = {};
                try {
                    json = await fs.readJSON(_loc);
                } catch (ex) {}

                this._fillMissing(json, enPhrases);

                json.lang = {...json.lang, code: lang, 'url-prefix': lang === 'en' ? '' : `/${lang}`};

                if (json.page) console.error('"page" is a system-wide keyword and should not be used at the root of localization.');
                if (json.data) console.error('"data" is a system-wide keyword and should not be used at the root of localization.');

                await fs.outputJSON(path.join(destinationDir, lang + '.json'), json);
                await fs.outputFile(path.join(destinationDir, lang + '.js'), `i18n.add(${JSON.stringify(json)})`);
            }
        } catch (e) {
            console.error(e);
        }

        await super.done();
    }

    async watch() {
        (await super.watch({
            paths: '**/*.json',
            cwd: 'i18n'
        }))
            .on('all', async (e, loc) => {
                console.log(`\n${(new Date()).toLocaleTimeString('en-US')} -> Changed ./i18n/${loc}`);
                await this.build();
            });
    }

    _fillMissing(dest, src) {
        if (src?.constructor.name !== 'Object') {
            throw 'The source for filling is not an object';
        }

        if (dest?.constructor.name !== 'Object') {
            throw 'The destination for filling is not an object';
        }

        // Destination shouldn't have any extra keys
        const destKeys = Object.keys(dest);
        let j = destKeys.length;
        while (j--) {
            if (!src[destKeys[j]]) delete dest[destKeys[j]];
        }

        const keys = Object.keys(src);
        let i = keys.length;
        while (i--) {
            if (dest[keys[i]]?.constructor.name === src[keys[i]].constructor.name) {
                if (src[keys[i]].constructor.name === 'Object') this._fillMissing(dest[keys[i]], src[keys[i]]);
                switch (src[keys[i]].constructor.name) {
                    case 'Object':
                        this._fillMissing(dest[keys[i]], src[keys[i]]);
                        break;

                    case 'Array':
                        // If the destination is not of the same length as source, overwrite it
                        if (dest[keys[i]].length !== src[keys[i]].length) dest[keys[i]] = src[keys[i]];
                        break;

                    default:
                        // If the destination is empty, overwrite it
                        if (!dest[keys[i]]) dest[keys[i]] = src[keys[i]];
                }
            } else {
                // If the destination is not of the same type as source, overwrite it
                dest[keys[i]] = src[keys[i]];
            }
        }
    }
}

module.exports = new Localization();