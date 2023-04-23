const fs = require('fs');
const { request } = require('undici');
const term = require('terminal-kit').terminal;
const path = require('path');
const downloadUrl = "https://raw.githubusercontent.com/Discord-Datamining/Discord-Datamining/master/current.js";
// const downloadUrl = "https://raw.githubusercontent.com/Discord-Datamining/Discord-Datamining/8f2f6fc0758c504c2c1c4c72cef2dc2a74895413/current.js";
// const downloadUrl = "https://raw.githubusercontent.com/Discord-Datamining/Discord-Datamining/dbc7d3a94fcd77ab33d7250809530a6eb1747853/current.js";
// const downloadUrl = "https://raw.githubusercontent.com/Discord-Datamining/Discord-Datamining/528bc1eafcf356689e21134e70ce05ccb92f89d8/current.js"; // OCT 2022
// const downloadUrl = "https://raw.githubusercontent.com/Discord-Datamining/Discord-Datamining/8a4e46c1b0bead45e8dd44b5aa133c18f1e31540/current.js"; // FEB 2021
// const downloadUrl = "https://raw.githubusercontent.com/Discord-Datamining/Discord-Datamining/80a630881a97ec3e035be4f79973f917f968b597/current.js"; // FEB 2022
// const downloadUrl = "https://raw.githubusercontent.com/Discord-Datamining/Discord-Datamining/e816b34f92b58fb1671cd81a7f133693e47ec49f/current.js" // May 2019

console.clear();

const progressBar = term.progressBar({
    width: 80,
    title: term.green('Downloading Current.js...'),
    eta: true,
    percent: true,
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
        term.green('\nDownloaded current.js successfully!');
    }, 1000);
})();