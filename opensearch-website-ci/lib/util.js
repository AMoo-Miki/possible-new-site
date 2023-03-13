const https = require('https');
const http = require('http');
const fs = require('fs-extra');

module.exports = {
    isNonEmptyObject(o) {
        if (!o || o.constructor.name !== 'Object') return false;
        for (let i in o) return true;
        return false;
    },
    isNonEmptyArray(o) {
        return Array.isArray(o) && o.length;
    },
    compareSets(as, bs) {
        if (as.size !== bs.size) return false;
        for (let a of as) if (!bs.has(a)) return false;
        return true;
    },
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    request(url, opts, data) {
        if (!/^https?:\/\//.test(url)) throw `${url} is invalid`;

        const proto = /^https/.test(url) ? https : http;
        return new Promise((resolve, reject) => {
            const req = proto.request(url, opts,
                res => {
                    let body = '';
                    res.on('data', chunk => (body += chunk.toString()));
                    res.on('error', reject);
                    res.on('end', () => {
                        if (res.statusCode >= 200 && res.statusCode <= 299) {
                            resolve({statusCode: res.statusCode, headers: res.headers, body: body});
                        } else {
                            reject({statusCode: res.statusCode, headers: res.headers, body: body});
                        }
                    });
                });

            req.on('error', err => {
                reject(err.message);
            });

            if (data) req.write(data, 'binary');

            req.end();
        });
    },
    download(url, dest) {
        if (!/^https?:\/\//.test(url)) throw `${url} is invalid`;
        if (!dest) throw 'No destination provided';

        fs.ensureFileSync(dest);

        const proto = /^https/.test(url) ? https : http;

        return new Promise((resolve, reject) => {
            const req = proto.get(url, res => {
                if (res.statusCode === 200) {
                    const file = fs.createWriteStream(dest, { flags: 'w' });
                    file.on('finish', () => resolve());
                    file.on('error', err => {
                        reject(err.message);
                    });
                    res.pipe(file);
                } else {
                    reject({statusCode: res.statusCode, headers: res.headers});
                }
            });

            req.on('error', err => {
                reject(err.message);
            });
        });
    }
}