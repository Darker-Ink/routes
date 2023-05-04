require('dotenv').config();
const { Octokit } = require("octokit");
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { request } = require('undici');
const WebhookUtils = require('./utils/WebhookUtils');
const term = require('terminal-kit').terminal;

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
    FirstChangedRoutes: path.join(__dirname, './saves/Json/First/ChangedRoutes.json'),
    FirstDeletedRoutes: path.join(__dirname, './saves/Json/First/DeletedRoutes.json'),
    FirstNewRoutes: path.join(__dirname, './saves/Json/First/NewRoutes.json'),
    FirstRoutes: path.join(__dirname, './saves/Json/First/Routes.json'),
    SecondChangedRoutes: path.join(__dirname, './saves/Json/Second/ChangedRoutes.json'),
    SecondDeletedRoutes: path.join(__dirname, './saves/Json/Second/DeletedRoutes.json'),
    SecondNewRoutes: path.join(__dirname, './saves/Json/Second/NewRoutes.json'),
    SecondRoutes: path.join(__dirname, './saves/Json/Second/Routes.json'),
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
     * @type {{ FirstChangedRoutes: import('../index').Routes, FirstDeletedRoutes: import('../index').Routes, FirstNewRoutes: import('../index').Routes, FirstRoutes: import('../index').Routes, SecondChangedRoutes: import('../index').Routes, SecondDeletedRoutes: import('../index').Routes, SecondNewRoutes: import('../index').Routes, SecondRoutes: import('../index').Routes }}}
     */
    const RouteStuff = {
        FirstChangedRoutes: JSON.parse(fs.readFileSync(paths.FirstChangedRoutes)),
        FirstDeletedRoutes: JSON.parse(fs.readFileSync(paths.FirstDeletedRoutes)),
        FirstNewRoutes: JSON.parse(fs.readFileSync(paths.FirstNewRoutes)),
        FirstRoutes: JSON.parse(fs.readFileSync(paths.FirstRoutes)),
        SecondChangedRoutes: JSON.parse(fs.readFileSync(paths.SecondChangedRoutes)),
        SecondDeletedRoutes: JSON.parse(fs.readFileSync(paths.SecondDeletedRoutes)),
        SecondNewRoutes: JSON.parse(fs.readFileSync(paths.SecondNewRoutes)),
        SecondRoutes: JSON.parse(fs.readFileSync(paths.SecondRoutes)),
    }

    let message = `# Modified Routes\n`;

    // if (changedRoutes.length > 0) {
    //     message += `## Changed Routes\n\n\`\`\`diff\n`;

    //     for (const route of changedRoutes) {
    //         const oldRoute = route.oldRoutes[route.oldRoutes.length - 1];
    //         message += `# ${route.key}\n- ${oldRoute.route}\n+ ${route.route}\n\n`;
    //     }

    //     message += `\`\`\`\n`;
    // }

    // if (deletedRoutes.length > 0) {
    //     message += `## Deleted Routes\n\n\`\`\`diff\n`;

    //     for (const route of deletedRoutes) {
    //         message += `- ${route.key}: ${route.route}\n`;
    //     }

    //     message += `\`\`\`\n`;
    // }

    // if (newRoutes.length > 0) {
    //     message += `## New Routes\n\n\`\`\`diff\n`;

    //     for (const route of newRoutes) {
    //         message += `+ ${route.key}: ${route.route}\n`;
    //     }

    //     message += `\`\`\`\n`;
    // }

    // if (changedRoutes.length === 0 && deletedRoutes.length === 0 && newRoutes.length === 0) {
    //     return;
    // }

    message+= `## First Object\n\n`;

    if (RouteStuff.FirstChangedRoutes.length > 0) {
        message += `## Changed Routes\n\n\`\`\`diff\n`;

        for (const route of RouteStuff.FirstChangedRoutes) {
            const oldRoute = route.oldRoutes[route.oldRoutes.length - 1];
            message += `# ${route.key}\n- ${oldRoute.route}\n+ ${route.route}\n\n`;
        }

        message += `\`\`\`\n`;
    }

    if (RouteStuff.FirstDeletedRoutes.length > 0) {
        message += `## Deleted Routes\n\n\`\`\`diff\n`;

        for (const route of RouteStuff.FirstDeletedRoutes) {
            message += `- ${route.key}: ${route.route}\n`;
        }

        message += `\`\`\`\n`;
    }

    if (RouteStuff.FirstNewRoutes.length > 0) {
        message += `## New Routes\n\n\`\`\`diff\n`;

        for (const route of RouteStuff.FirstNewRoutes) {
            message += `+ ${route.key}: ${route.route}\n`;
        }

        message += `\`\`\`\n`;
    }

    message+= `## Second Object\n\n`;

    if (RouteStuff.SecondChangedRoutes.length > 0) {
        message += `## Changed Routes\n\n\`\`\`diff\n`;

        for (const route of RouteStuff.SecondChangedRoutes) {
            const oldRoute = route.oldRoutes[route.oldRoutes.length - 1];
            message += `# ${route.key}\n- ${oldRoute.route}\n+ ${route.route}\n\n`;
        }

        message += `\`\`\`\n`;
    }

    if (RouteStuff.SecondDeletedRoutes.length > 0) {
        message += `## Deleted Routes\n\n\`\`\`diff\n`;
        
        for (const route of RouteStuff.SecondDeletedRoutes) {
            message += `- ${route.key}: ${route.route}\n`;
        }

        message += `\`\`\`\n`;
    }

    if (RouteStuff.SecondNewRoutes.length > 0) {
        message += `## New Routes\n\n\`\`\`diff\n`;

        for (const route of RouteStuff.SecondNewRoutes) {
            message += `+ ${route.key}: ${route.route}\n`;
        }

        message += `\`\`\`\n`;
    }

    if (RouteStuff.FirstChangedRoutes.length === 0 && RouteStuff.FirstDeletedRoutes.length === 0 && RouteStuff.FirstNewRoutes.length === 0 && RouteStuff.SecondChangedRoutes.length === 0 && RouteStuff.SecondDeletedRoutes.length === 0 && RouteStuff.SecondNewRoutes.length === 0) {
        return;
    }

    message += `\n(Any thing marked as :unknown is an unknown parameter)\n`;

    return message;
};

const start = async () => {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    term.cyan(`[${new Date().toLocaleString('Us', { hour12: false })} Server] Started\n`);

    const { data: { object: { sha: FirstSha } } } = await octokit.rest.git.getRef({
        owner: process.env.REPO_OWNER,
        repo: process.env.REPO_NAME,
        ref: process.env.BRANCH
    });

    const FirstMsg = await run();

    if (FirstMsg) {
        
            WebhookUtils.stats(`${FirstMsg}\n\n[Relating Commit](https://github.com/Discord-Datamining/Discord-Datamining/commit/${FirstSha})`);
        
        await octokit.rest.repos.createCommitComment({
            owner: process.env.REPO_OWNER,
            repo: process.env.REPO_NAME,
            commit_sha: FirstSha,
            body: FirstMsg
        }).catch((er) => console.error(er))

        term.cyan(`[${new Date().toLocaleString('Us', { hour12: false })} Server] Comment Created\n`);
    }

    let lastCommit = FirstSha;

    setInterval(async () => {
        const { data: { object: { sha } } } = await octokit.rest.git.getRef({
            owner: process.env.REPO_OWNER,
            repo: process.env.REPO_NAME,
            ref: process.env.BRANCH
        });

        if (lastCommit === sha) {
            term.cyan(`[${new Date().toLocaleString('Us', { hour12: false })} Server] No Changes\n`);
            return;
        }

        lastCommit = sha;

        const msg = await run();

        if (msg) {
            WebhookUtils.stats(`${msg}\n\n[Relating Commit](https://github.com/Discord-Datamining/Discord-Datamining/commit/${sha})`);
            
            await octokit.rest.repos.createCommitComment({
                owner: process.env.REPO_OWNER,
                repo: process.env.REPO_NAME,
                commit_sha: sha,
                body: msg
            }).catch((er) => console.error(er))

            term.cyan(`[${new Date().toLocaleString('Us', { hour12: false })} Server] Comment Created\n`);

            if (process.env.ADD_ROUTES === 'true') {
                const Pushing = spawn('git', ['add', '.', '&&', 'git', 'commit', '-m', '"[BOT] Updated Routes"', '&&', 'git', 'push']);

                Pushing.on('close', () => {
                    term.cyan(`[${new Date().toLocaleString('Us', { hour12: false })} Server] Pushed\n`);
                });
            }

        }
    }, Number(process.env.INTERVAL));
};

start();
