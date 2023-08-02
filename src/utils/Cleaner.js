const dashAst = require("dash-ast");
const acorn = require("acorn");
const fs = require("fs");
const path = require("path");
const { request } = require("undici");
const config = require('./ConfigManager').getConfig();
const { inspect } = require('node:util');
const GetGlobalEnv = require("./GlobalEnv");

const ErrorHooks = config.Webhooks.filter((hook) => hook.send.errors);
let errorsSent = 0;
const regex = new RegExp(`\\b\\w+\\b(?=\\s*=\\s*"${config.Misc.id}")`);

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

(async () => {
    const currentJs = fs.readFileSync(path.join(__dirname, "../saves/current.js"), "utf8");
    const parsed = acorn.parse(currentJs, {
        ecmaVersion: 2020,
    });
    const checkRoutes = [["BILLING_PREFIX", "/billing"], ["FRIENDS", "/channels/@me"], ["LOGIN", "/login"], ["ACTIVITIES", "/activities"], ["USERS", "/users"], ["ME", "/users/@me"]];
    const freezeCalls = {};

    dashAst(parsed, function (node, parent) {
        if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && node.callee.property.name === "freeze") {
            if (node.arguments[0]?.type === "ObjectExpression") {
                const args = node.arguments[0];

                const isCorrectObject = args.properties.some(prop => checkRoutes.some(stuff => stuff[0] === prop.key.name && stuff[1] === prop.value.value));

                if (isCorrectObject) {
                    freezeCalls[parent.id.name] = node;
                }
            }
        }
    });

    let start = -1;
    let end = -1;

    const beforeCode = [];

    for (const frozenn in freezeCalls) {
        const frozen = freezeCalls[frozenn];

        if (start === -1) {
            start = frozen.start;
        }

        end = frozen.end;

        for (const proptery of frozen.arguments[0].properties) {
            const value = proptery.value.type;

            if (value === "ConditionalExpression") {
                beforeCode.push(`const ${proptery.value.test.object.name} = { ${proptery.value.test.property.name}: null }`);
            }

            const args = proptery?.value?.body?.body?.[0]?.argument;//?.arguments?.[0];
            const args2 = proptery?.value?.body?.body?.[0]?.argument?.callee?.object?.arguments;

            if (args?.arguments?.[0].type === "MemberExpression" || args?.right && args.right.type === "MemberExpression") {
                const prop = args?.arguments?.[0] || args?.right;

                const alreadyDefined = beforeCode.find(code => code.includes(prop.object.name));

                if (alreadyDefined) {
                    const index = beforeCode.indexOf(alreadyDefined);
                    beforeCode[index] = alreadyDefined.replace("}", `, ${prop.property.name}: null }`);
                } else {
                    beforeCode.push(`const ${prop.object.name} = { ${prop.property.name}: null }`);
                }
            }


            if (args2) {
                const first = args2[0];

                if (first.type === "MemberExpression") {
                    const alreadyDefined = beforeCode.find(code => code.includes(first.object.object.name));

                    if (alreadyDefined) {
                        const index = beforeCode.indexOf(alreadyDefined);
                        beforeCode[index] = alreadyDefined.replace("}", `, ${first.object.property.name}: { ${first.property.name}: null } }`);
                    } else {
                        beforeCode.push(`const ${first.object.object.name} = { ${first.object.property.name}: { ${first.property.name}: null } }`);
                    }
                }
            }
        }
    }

    const MatchedCode = currentJs.match(regex);

    if (!MatchedCode) {
        console.error("Couldn't find the code to replace");
    } else {
        beforeCode.push(`const ${MatchedCode[0]} = "${config.Misc.id}"`);
    }

    const GlobalEnv = await GetGlobalEnv();

    beforeCode.push(`window = {}`);
    beforeCode.push(GlobalEnv);

    const code = currentJs.slice(start, end);
    const keys = Object.keys(freezeCalls);
    const newCode = code.replace(keys[0] + " = Object.fre", "FirstRoutes = Object.fre").replace(keys[1] + " = Object.fre", "SecondRoutes = Object.fre");

    // just some fake location code in case it gets used
    const fakeLocationCode = `const location = { protocol: "https", host: "discord.com", pathname: "/api/v9" };`;
    fs.writeFileSync(path.join(__dirname, "../saves/Routes.js"), beforeCode.join(";") + ";" + `${fakeLocationCode}const FirstRoutes = ${newCode};module.exports = { FirstRoutes, ${keys.length > 1 ? "SecondRoutes" : ""} }`, "utf8");
})();