const { Octokit } = require("octokit");
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { request } = require('undici');
const term = require('terminal-kit').terminal;

const config = require('./utils/ConfigManager').getConfig();

const ErrorHooks = config.Webhooks.filter((hook) => hook.send.errors);
const SendHooks = config.Webhooks.filter((hook) => hook.send.enabled);

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
    };

    let message = `# Modified Routes\n`;


    if (RouteStuff.FirstChangedRoutes.length > 0) {
        message += `## First Object\n\n`;
        message += `## Changed Endpoints\n\n\`\`\`diff\n`;

        for (const route of RouteStuff.FirstChangedRoutes) {
            const oldRoute = route.oldRoutes[route.oldRoutes.length - 1];
            message += `# ${route.key}\n- ${oldRoute.route}\n+ ${route.route}\n\n`;
        }

        message += `\`\`\`\n`;
    }

    if (RouteStuff.FirstDeletedRoutes.length > 0) {
        message += `## Deleted Endpoints\n\n\`\`\`diff\n`;

        for (const route of RouteStuff.FirstDeletedRoutes) {
            message += `- ${route.key}: ${route.route}\n`;
        }

        message += `\`\`\`\n`;
    }

    if (RouteStuff.FirstNewRoutes.length > 0) {
        message += `## New Endpoints\n\n\`\`\`diff\n`;

        for (const route of RouteStuff.FirstNewRoutes) {
            message += `+ ${route.key}: ${route.route}\n`;
        }

        message += `\`\`\`\n`;
    }


    if (RouteStuff.SecondChangedRoutes.length > 0) {
        message += `## Second Object\n\n`;
        message += `## Changed Endpoints\n\n\`\`\`diff\n`;

        for (const route of RouteStuff.SecondChangedRoutes) {
            const oldRoute = route.oldRoutes[route.oldRoutes.length - 1];
            message += `# ${route.key}\n- ${oldRoute.route}\n+ ${route.route}\n\n`;
        }

        message += `\`\`\`\n`;
    }

    if (RouteStuff.SecondDeletedRoutes.length > 0) {
        message += `## Deleted Endpoints\n\n\`\`\`diff\n`;

        for (const route of RouteStuff.SecondDeletedRoutes) {
            message += `- ${route.key}: ${route.route}\n`;
        }

        message += `\`\`\`\n`;
    }

    if (RouteStuff.SecondNewRoutes.length > 0) {
        message += `## New Endpoints\n\n\`\`\`diff\n`;

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
    const octokit = new Octokit({ auth: config.GithubToken });

    term.cyan(`[${new Date().toLocaleString('Us', { hour12: false })} Server] Started\n`);

    const { data: { object: { sha: FirstSha } } } = await octokit.rest.git.getRef({
        owner: config.RepoOwner,
        repo: config.RepoName,
        ref: config.RepoBranch
    });

    const FirstMsg = await run();

    if (FirstMsg) {
        for (const hook of SendHooks) {
            await request(hook.url, {
                body: JSON.stringify({
                    embeds: [{
                        title: 'New Endpoints',
                        description: `${FirstMsg}\n\n[Relating Commit](https://github.com/Discord-Datamining/Discord-Datamining/commit/${FirstSha})`,
                        color: 0x00FF00, // green
                        timestamp: new Date().toISOString(),
                    }],
                    ...(hook.send.ping ? { content: hook.pingMsg } : {})
                }),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
        }

        await octokit.rest.repos.createCommitComment({
            owner: config.RepoOwner,
            repo: config.RepoName,
            commit_sha: FirstSha,
            body: FirstMsg
        }).catch((er) => console.error(er));

        term.cyan(`[${new Date().toLocaleString('Us', { hour12: false })} Server] Comment Created\n`);
    }

    let lastCommit = FirstSha;

    setInterval(async () => {
        const { data: { object: { sha } } } = await octokit.rest.git.getRef({
            owner: config.RepoOwner,
            repo: config.RepoName,
            ref: config.RepoBranch
        });

        if (lastCommit === sha) {
            term.cyan(`[${new Date().toLocaleString('Us', { hour12: false })} Server] No Changes\n`);
            return;
        }

        lastCommit = sha;

        const msg = await run();

        if (msg) {
            for (const hook of SendHooks) {
                await request(hook.url, {
                    body: JSON.stringify({
                        embeds: [{
                            title: 'New Endpoints',
                            description: `${msg}\n\n[Relating Commit](https://github.com/Discord-Datamining/Discord-Datamining/commit/${sha})`,
                            color: 0x00FF00, // green
                            timestamp: new Date().toISOString(),
                        }],
                        ...(hook.send.ping ? { content: hook.pingMsg } : {})
                    }),
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
            }

            await octokit.rest.repos.createCommitComment({
                owner: config.RepoOwner,
                repo: config.RepoName,
                commit_sha: sha,
                body: msg
            }).catch((er) => console.error(er));

            term.cyan(`[${new Date().toLocaleString('Us', { hour12: false })} Server] Comment Created\n`);

            if (config.commitNewEndpoints) {
                const Pushing = spawn('git', ['add', '.', '&&', 'git', 'commit', '-m', `"${config.commitNewEndpointsMsg}"`, '&&', 'git', 'push'], {
                    shell: true, stdio: 'inherit'
                });

                Pushing.on('close', () => {
                    term.cyan(`[${new Date().toLocaleString('Us', { hour12: false })} Server] Pushed\n`);
                });
            }
        }
    }, Number(config.Interval));
};

start();
