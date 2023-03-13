const fs = require('fs-extra');
const path = require('path');
const http = require('http');

const DEBUG = false;

const __root = path.dirname(__dirname);
const __build = path.join(__root, 'build');

const Assets = require('./lib/assets');
Assets.rootDir = __root;
Assets.destinationDir = __build;
Assets.minify = !DEBUG;

const Data = require('./lib/data');
Data.rootDir = __root;
Data.destinationDir = __build;
Data.minify = !DEBUG;

const Localization = require('./lib/localization');
Localization.rootDir = __root;
Localization.destinationDir = __build;

const Elements = require('./lib/elements');
Elements.rootDir = __root;
Elements.destinationDir = __build;
Elements.minify = !DEBUG;

const Pages = require('./lib/pages');
Pages.rootDir = __root;
Pages.destinationDir = __build;

const Docs = require('./lib/docs');
Docs.rootDir = __root;
Docs.destinationDir = __build;

const Events = require('./lib/events');
Events.rootDir = __root;
Events.destinationDir = __build;

const ACCEPTABLE_MIMES = require('./config/mime-types.json');
const extMatcher = new RegExp(`\.(${Object.keys(ACCEPTABLE_MIMES).join('|')})$`);

const SUPPORTED_LANGS = require('./config/langs.json');
const LANGUAGES = Object.keys(SUPPORTED_LANGS);
const langMatcher = new RegExp(`^\/(?:(${LANGUAGES.join('|')})(?:\/|$))?`);


(async () => {
    // Clean
    await fs.emptyDir(__build);

    //Build
    await Assets.build();
    await Data.build();
    await Localization.build();
    await Elements.build();
    await Pages.build();
    await Docs.build();
    await Events.build();

    //Watch
    await Assets.watch();
    await Data.watch();
    await Localization.watch();
    await Elements.watch();
    await Pages.watch();
    await Docs.watch();
    await Events.watch();

    Localization.on('done', async () => {
        await Pages.build();
        await Docs.build();
        await Events.build();
    });

    Assets.on('done:HTML', async () => {
        await Pages.build();
        await Docs.build();
    });

    Data.on('done', async () => {
        await Pages.build();
        await Docs.build();
        await Events.build();
    });

    //Serve
    http.createServer((req, res) => {
        const match = req.url.match(extMatcher);
        const _loc = req.url.replace(/\.{2}/g, '');
        let file, mime;

        if (match?.[1]) {
            mime = ACCEPTABLE_MIMES[match[1]];
            file = path.join(__build, _loc);
        } else {
            const [, lang] = req.url.match(langMatcher);

            if (lang && (lang === 'en' || !SUPPORTED_LANGS[lang])) {
                res.writeHead(301, {'Location': '/'});
                res.end();
                return;
            }

            mime = ACCEPTABLE_MIMES.html;
            file = path.join(__build, _loc, 'index.html');
        }

        if (file) {
            try {
                fs.accessSync(file, fs.constants.R_OK);

                res.writeHead(200, {'Content-Type': mime});
                res.end(fs.readFileSync(file));
                return;
            } catch (e) {}
        }

        console.log(file);

        res.writeHead(404, {'Content-Type': ACCEPTABLE_MIMES.html});
        res.end('404 Not Found');
    }).listen(8080);
})();
