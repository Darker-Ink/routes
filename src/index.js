require('dotenv').config();
const { Octokit } = require("octokit");
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { request } = require('undici');

process.on('unhandledRejection', async (reason, promise) => {
    await request(process.env.WEBHOOK, {
        body: JSON.stringify({
            embeds: [{
                title: 'Unhandled Rejection',
                description: `\`\`\`\n${reason.stack}\n\`\`\``,
                color: 0xFF0000, // red
                timestamp: new Date().toISOString(),
            }]
        }),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });

    console.error(reason);
});

process.on('uncaughtException', async (error) => {
    await request(process.env.WEBHOOK, {
        body: JSON.stringify({
            embeds: [{
                title: 'Uncaught Exception',
                description: `\`\`\`\n${error.stack}\n\`\`\``,
                color: 0xFF0000, // red
                timestamp: new Date().toISOString(),
            }]
        }),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });

    console.error(error);
});

const paths = {
    ChangedRoutes: path.join(__dirname, './saves/Json/ChangedRoutes.json'),
    DeletedRoutes: path.join(__dirname, './saves/Json/DeletedRoutes.json'),
    NewRoutes: path.join(__dirname, './saves/Json/NewRoutes.json'),
    Routes: path.join(__dirname, './saves/Json/Routes.json'),
};

const runStuff = () => {
    return new Promise((resolve) => {
        const npmStart = spawn('npm', ['start'], {
            shell: true, stdio: 'inherit'
        });

        npmStart.on('close', () => {
            resolve();
        });
    });
};

const run = async () => {
    await runStuff();

    /**
     * @type {import('../index').Routes}
     */
    const changedRoutes = JSON.parse(fs.readFileSync(paths.ChangedRoutes));
    /**
     * @type {import('../index').Routes}
     */
    const deletedRoutes = JSON.parse(fs.readFileSync(paths.DeletedRoutes));
    /**
     * @type {import('../index').Routes}
     */
    const newRoutes = JSON.parse(fs.readFileSync(paths.NewRoutes));

    let message = `# Modified Routes\n`;

    if (changedRoutes.length > 0) {
        message += `## Changed Routes\n\n\`\`\`diff\n`;

        for (const route of changedRoutes) {
            const oldRoute = route.oldRoutes[route.oldRoutes.length - 1];
            message += `- ${route.key}: ${oldRoute.route}\n+ ${route.key}: ${route.route}\n`;
        }

        message += `\`\`\`\n`;
    }

    if (deletedRoutes.length > 0) {
        message += `## Deleted Routes\n\n\`\`\`diff\n`;

        for (const route of deletedRoutes) {
            message += `- ${route.key}: ${route.route}\n`;
        }

        message += `\`\`\`\n`;
    }

    if (newRoutes.length > 0) {
        message += `## New Routes\n\n\`\`\`diff\n`;

        for (const route of newRoutes) {
            message += `+ ${route.key}: ${route.route}\n`;
        }

        message += `\`\`\`\n`;
    }

    if (changedRoutes.length === 0 && deletedRoutes.length === 0 && newRoutes.length === 0) {
        return;
    }

    message += `\n(Any thing marked as :unknown is an unknown parameter)\n`;

    return message;
};

const start = async () => {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    console.log('[SERVER] Started');

    const { data: { object: { sha: FirstSha } } } = await octokit.rest.git.getRef({
        owner: process.env.REPO_OWNER,
        repo: process.env.REPO_NAME,
        ref: process.env.BRANCH
    });

    const FirstMsg = await run();

    if (FirstMsg) {
        await octokit.rest.repos.createCommitComment({
            owner: process.env.REPO_OWNER,
            repo: process.env.REPO_NAME,
            commit_sha: sha, // temp
            body: FirstMsg
        });

        console.log(`[SERVER] Comment Created`);
    } else {

    }

    let lastCommit = FirstSha;

    setInterval(async () => {
        const { data: { object: { sha } } } = await octokit.rest.git.getRef({
            owner: process.env.REPO_OWNER,
            repo: process.env.REPO_NAME,
            ref: process.env.BRANCH
        });

        if (lastCommit === sha) {
            console.log('[SERVER] No Changes');
            return;
        }

        lastCommit = sha;

        const msg = await run();

        if (msg) {
            await octokit.rest.repos.createCommitComment({
                owner: process.env.REPO_OWNER,
                repo: process.env.REPO_NAME,
                commit_sha: sha, // temp
                body: msg
            });

            console.log(`[SERVER] Comment Created`);
        }
    }, Number(process.env.INTERVAL));
};

start();