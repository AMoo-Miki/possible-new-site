const path = require('path');
const fs = require('fs-extra');
const YAML = require('yaml');
const matter = require('gray-matter');
const marked = require('marked');
const Task = require("./task");
const {isNonEmptyArray} = require("./util");

class Data extends Task {
    async build() {
        await super.build();

        try {
            const sourceDir = path.join(this.rootDir, 'data');
            const fullDataFile = path.join(this.destinationDir, 'data/full-data.json');
            const dataFile = path.join(this.destinationDir, 'data/data.json');
            await fs.ensureFile(dataFile);

            const postsFile = path.join(this.destinationDir, 'data/posts.json');
            const faqsFile = path.join(this.destinationDir, 'data/faqs.json');
            const eventsFile = path.join(this.destinationDir, 'data/events.json');

            const result = await this._walk(sourceDir);
            await fs.writeJSON(fullDataFile, result);

            let {posts, faqs, events, ...data} = result;

            if (posts) {
                posts = this._processPosts(posts);

                if (isNonEmptyArray(posts)) {
                    data.posts = {
                        recent: posts.slice(0, 5).map(post => ({...post[1], key: post[0]})),
                        count: posts.length
                    };
                } else {
                    posts = [];
                }

                await fs.writeJSON(postsFile, posts);
            }

            if (faqs) {
                faqs = this._processFAQs(faqs);
                if (!isNonEmptyArray(faqs)) faqs = [];

                await fs.writeJSON(faqsFile, faqs);
            }

            if (events) {
                events = this._processEvents(events);
                if (!isNonEmptyArray(events)) events = [];

                await fs.writeJSON(eventsFile, events);
            }

            await fs.writeJSON(dataFile, data);
        } catch (e) {
            console.error(e);
        }

        await super.done();
    }

    async _compile(loc) {
        const ext = path.extname(loc);
        switch (ext) {
            case '.yml':
                return YAML.parse((await fs.readFile(loc)).toString());

            case '.markdown':
            case '.md':
                let {content, data} = matter((await fs.readFile(loc)).toString());

                if (content) content = marked(content);

                return {data, content};
        }
    }

    async _walk(loc) {
        const data = {};
        const files = await fs.readdir(loc);
        for (let file of files) {
            const _loc = path.join(loc, file);
            const stat = await fs.lstat(_loc);
            const filename = path.parse(file).name;
            if (stat.isDirectory()) {
                data[filename] = await this._walk(_loc);
            } else if (stat.isFile()) {
                data[filename] = await this._compile(_loc);
            }
        }
        return data;
    }

    _processPosts(posts) {
        const result = new Map();
        Object.keys(posts).forEach(item => {
            if (item[0] === '_') return;

            const [y, m, d, ...rest] = item.toLowerCase().split('-');
            result.set(`${y}/${m}/${d}/${rest.join('-')}`, posts[item]);
        });

        return [...result.entries()]
            .map(([key, post]) => {
                const o = {...post, key};
                delete o.canonical;
                delete o.comments;
                delete o.layout;
                if (Array.isArray(o.categories)) o.category = o.categories?.[0];
                else o.category = o.categories;
                delete o.categories;
                return o;
            })
            .sort((a, b) => b.key.localeCompare(a.key));
    }

    _processFAQs(faqs) {
        const result = [];
        Object.keys(faqs).forEach(item => {
            const faq = faqs[item];

            let [category, idx, ...rest] = item.split('-');
            category = parseInt(category);
            idx = parseInt(idx);
            const key = rest.join('-')?.trim?.();

            if (!faq?.data?.question || !faq.content || !key || isNaN(category) || isNaN(idx))
                throw `Malformed FAQ (${item})`;

            result.push({category, idx, key, question: faq.data.question, content: faq.content})
        });

        return result;
    }

    _processEvents(events) {
        const result = [];
        Object.keys(events).forEach(key => {
            if (!events[key]?.data?.eventdate)
                throw `Malformed event (${key})`;

            result.push({...events[key], key});
        });

        result.sort((a, b) => a.data.eventdate.localeCompare(b.data.eventdate));

        return result;
    }

    async watch() {
        (await super.watch({
            paths: '**/*',
            cwd: 'data'
        }))
            .on('all', async (e, loc) => {
                console.log(`\n${(new Date()).toLocaleTimeString('en-US')} -> Changed ./data/${loc}`);
                await this.build();
            });
    }
}

module.exports = new Data();