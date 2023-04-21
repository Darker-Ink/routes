const fs = require('fs');
const { request } = require('undici');
const term = require('terminal-kit').terminal;
const path = require('path');
const downloadUrl = "https://raw.githubusercontent.com/Discord-Datamining/Discord-Datamining/master/current.js";
// const downloadUrl = "https://raw.githubusercontent.com/Discord-Datamining/Discord-Datamining/8f2f6fc0758c504c2c1c4c72cef2dc2a74895413/current.js";

console.clear();

const progressBar = term.progressBar({
    width: 80,
    title: term.green('Downloading Current.js...'),
    eta: true,
    percent: true
});

(async () => {
    const { body, headers } = await request(downloadUrl);
    const contentLength = parseInt(headers['content-length'], 10);

    const chunks = [];
    let downloaded = 0;

    for await (const chunk of body) {
        chunks.push(chunk);
        downloaded += chunk.length;
        progressBar.update(downloaded / contentLength);
    }

    const code = Buffer.concat(chunks).toString('utf8');

    fs.writeFileSync(path.join(__dirname, '../saves/current.js'), code);

    setTimeout(() => {
        term('\n');
        term.green('Downloaded current.js successfully!');
    }, 1000);
})();