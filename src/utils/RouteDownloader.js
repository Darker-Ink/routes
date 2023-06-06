const fs = require('fs');
const { request } = require('undici');
const term = require('terminal-kit').terminal;
const path = require('path');

const ErrorHooks = config.Webhooks.filter((hook) => hook.send.errors);
let errorsSent = 0;

process.on('unhandledRejection', async (reason, promise) => {

    if (errorsSent >= 10) {
        process.exit(1);
    }

    // fuck rate limits (I honestly doubt we'll send enough)
    for (const hook of ErrorHooks) {
        await request(hook.url, {
            body: JSON.stringify({
                embeds: [{
                    title: 'Unhandled Rejection',
                    description: `\`\`\`\n${reason.stack}\n\`\`\``,
                    color: 0xFF0000, // red
                    timestamp: new Date().toISOString(),
                }],
                content: config.ErrorMsg
            }),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
    }

    console.error(reason);

    errorsSent++;
});

process.on('uncaughtException', async (error) => {

    if (errorsSent >= 10) {
        process.exit(0);
    }

    for (const hook of ErrorHooks) {
        await request(hook.url, {
            body: JSON.stringify({
                embeds: [{
                    title: 'Uncaught Exception',
                    description: `\`\`\`\n${error.stack}\n\`\`\``,
                    color: 0xFF0000, // red
                    timestamp: new Date().toISOString(),
                }],
                content: config.ErrorMsg
            }),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
    }

    console.error(error);

    errorsSent++;
});


const downloadUrl = "https://raw.githubusercontent.com/Discord-Datamining/Discord-Datamining/master/current.js";
// const downloadUrl = "https://raw.githubusercontent.com/Discord-Datamining/Discord-Datamining/0bfd0eebbf023108cddcb3ad7f2d45f722fe8b6a/current.js";
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