const fs = require('fs');
const { request } = require('undici');
const term = require('terminal-kit').terminal;
const path = require('path');
const config = require('./ConfigManager').getConfig();

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


const downloadUrl = "https://raw.githubusercontent.com/Darker-Ink/endpoint-downloader/master/currentRoutes.js";

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
