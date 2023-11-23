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

    console.error(reason);

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

    // console.error(reason);

    errorsSent++;
});

process.on('uncaughtException', async (error) => {

    console.error(error);

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

    errorsSent++;
});

const paths = {
    ChangedEndpoints: path.join(__dirname, './saves/Json/Endpoints/Changed.json'),
    DeletedEndpoints: path.join(__dirname, './saves/Json/Endpoints/Deleted.json'),
    NewEndpoints: path.join(__dirname, './saves/Json/Endpoints/New.json'),
    Endpoints: path.join(__dirname, './saves/Json/Endpoints/Endpoints.json'),
    ChangedRoutes: path.join(__dirname, './saves/Json/Routes/Changed.json'),
    DeletedRoutes: path.join(__dirname, './saves/Json/Routes/Deleted.json'),
    NewRoutes: path.join(__dirname, './saves/Json/Routes/New.json'),
    Routes: path.join(__dirname, './saves/Json/Routes/Routes.json'),
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
     * @type {{ ChangedEndpoints: import('../index').Routes, DeletedEndpoints: import('../index').Routes, NewEndpoints: import('../index').Routes, Endpoints: import('../index').Routes, ChangedRoutes: import('../index').Routes, DeletedRoutes: import('../index').Routes, NewRoutes: import('../index').Routes, Routes: import('../index').Routes }}}
     */
    const RouteStuff = {
        ChangedEndpoints: JSON.parse(fs.readFileSync(paths.ChangedEndpoints)),
        DeletedEndpoints: JSON.parse(fs.readFileSync(paths.DeletedEndpoints)),
        NewEndpoints: JSON.parse(fs.readFileSync(paths.NewEndpoints)),
        Endpoints: JSON.parse(fs.readFileSync(paths.Endpoints)),
        ChangedRoutes: JSON.parse(fs.readFileSync(paths.ChangedRoutes)),
        DeletedRoutes: JSON.parse(fs.readFileSync(paths.DeletedRoutes)),
        NewRoutes: JSON.parse(fs.readFileSync(paths.NewRoutes)),
        Routes: JSON.parse(fs.readFileSync(paths.Routes)),
    };

    if (!fs.existsSync(path.join(__dirname, './metadata.json'))) {
        fs.writeFileSync(path.join(__dirname, './metadata.json'), JSON.stringify({lastCheckDate: 1}));
    }

    const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, './metadata.json')));

    let message = "";

    if (RouteStuff.ChangedEndpoints.length > 0) {
        message += `## Changed Endpoints\n\n\`\`\`diff\n`;

        for (const route of RouteStuff.ChangedEndpoints) {
            const oldRoute = route.oldRoutes[route.oldRoutes.length - 1];
            message += `# ${route.key}\n- ${oldRoute.route}\n+ ${route.route}\n\n`;
        }

        message += `\`\`\`\n`;
    }

    if (RouteStuff.DeletedEndpoints.length > 0) {
        message += `## Deleted Endpoints\n\n\`\`\`diff\n`;

        for (const route of RouteStuff.DeletedEndpoints) {
            message += `- ${route.key}: ${route.route}\n`;
        }

        message += `\`\`\`\n`;
    }

    if (RouteStuff.NewEndpoints.length > 0) {
        message += `## New Endpoints\n\n\`\`\`diff\n`;

        for (const route of RouteStuff.NewEndpoints) {
            message += `+ ${route.key}: ${route.route}\n`;
        }

        message += `\`\`\`\n`;
    }

    if (RouteStuff.ChangedRoutes.length > 0) {
        message += `## Changed Routes\n\n\`\`\`diff\n`;

        for (const route of RouteStuff.ChangedRoutes) {
            const oldRoute = route.oldRoutes[route.oldRoutes.length - 1];
            message += `# ${route.key}\n- ${oldRoute.route}\n+ ${route.route}\n\n`;
        }

        message += `\`\`\`\n`;
    }

    if (RouteStuff.DeletedRoutes.length > 0) {
        message += `## Deleted Routes\n\n\`\`\`diff\n`;

        for (const route of RouteStuff.DeletedRoutes) {
            message += `- ${route.key}: ${route.route}\n`;
        }

        message += `\`\`\`\n`;
    }

    if (RouteStuff.NewRoutes.length > 0) {
        message += `## New Routes\n\n\`\`\`diff\n`;

        for (const route of RouteStuff.NewRoutes) {
            message += `+ ${route.key}: ${route.route}\n`;
        }

        message += `\`\`\`\n`;
    }

    if (RouteStuff.ChangedEndpoints.length === 0 && RouteStuff.DeletedEndpoints.length === 0 && RouteStuff.NewEndpoints.length === 0 && RouteStuff.ChangedRoutes.length === 0 && RouteStuff.DeletedRoutes.length === 0 && RouteStuff.NewRoutes.length === 0) {
        return;
    }

    // if last check date is more then 1 day ago then add an extra message saying sorry for the delay
    if (metadata.lastCheckDate && Date.now() - metadata.lastCheckDate > 86400000) {
        message += `\nSorry for the delay!`;
    }

    message += `\n(Any thing marked as :unknown is an unknown parameter)\n`;

    metadata.lastCheckDate = Date.now();

    fs.writeFileSync(path.join(__dirname, './metadata.json'), JSON.stringify(metadata));

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
                        title: 'New Routes & (or) Endpoints',
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

        // await octokit.rest.repos.createCommitComment({
        //     owner: config.RepoOwner,
        //     repo: config.RepoName,
        //     commit_sha: FirstSha,
        //     body: FirstMsg
        // }).catch((er) => console.error(er));

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

        await new Promise((resolve) => setTimeout(resolve, 1000)); // just for github sometimes being dumb and providing the wrong file

        const msg = await run();

        if (msg) {
            for (const hook of SendHooks) {
                await request(hook.url, {
                    body: JSON.stringify({
                        embeds: [{
                            title: 'New Routes & (or) Endpoints',
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

            // await octokit.rest.repos.createCommitComment({
            //     owner: config.RepoOwner,
            //     repo: config.RepoName,
            //     commit_sha: sha,
            //     body: msg
            // }).catch((er) => console.error(er));

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
