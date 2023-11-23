const options = {
    "indent_size": "4",
    "indent_char": " ",
    "max_preserve_newlines": "5",
    "preserve_newlines": true,
    "keep_array_indentation": false,
    "break_chained_methods": false,
    "indent_scripts": "normal",
    "brace_style": "collapse",
    "space_before_conditional": true,
    "unescape_strings": false,
    "jslint_happy": false,
    "end_with_newline": false,
    "wrap_line_length": "0",
    "indent_inner_html": false,
    "comma_first": false,
    "e4x": false,
    "indent_empty_lines": false
};
const term = require('terminal-kit').terminal;
const js_beautify = require("js-beautify").js_beautify;
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

term.yellow("Cleaning...\n");

const TwoWayLinkStuff = {
    TwoWayLinkType: {
        MOBILE: "mobile",
        DESKTOP: "desktop",
        WEB: "web",
        DEVICE_CODE: "device_code"
    }
};

const MiscJoinStuff = {
    JOIN: 1,
    LISTEN: 3,
    WATCH: 4,
    JOIN_REQUEST: 5,
    RTC: 1,
    IOS_APP: 2,
    WEB_APP: 3,
    ANDROID_APP: 4,
    SPEED_TEST: 5,
    DEFAULT: 0,
    HIGH_SCHOOL: 1,
    COLLEGE: 2
};

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

    const beautified = js_beautify(currentJs, options);

    const parsed = acorn.parse(beautified, {
        ecmaVersion: 2020,
    });

    term.yellow("\nBeautified");

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

            let i = proptery?.value?.body?.callee?.object?.arguments?.find(x => x?.type === "MemberExpression")?.object ?? proptery?.value?.body?.arguments?.find(arg => arg?.type === "MemberExpression")

            if (i) {
                const name = i.object.name;
                const property = i.property.name;

                const MiscStuff = MiscJoinStuff[property]
                const TwoWayStuff = TwoWayLinkStuff[property];

                if (MiscStuff) {
                    beforeCode.push(`const ${name} = ${JSON.stringify(MiscJoinStuff)}`);
                } else if (TwoWayStuff) {
                    beforeCode.push(`const ${name} = ${JSON.stringify(TwoWayLinkStuff)}`);
                }
            }

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

    const MatchedCode = beautified.match(regex);

    if (!MatchedCode) {
        console.error("Couldn't find the code to replace");
    } else {
        beforeCode.push(`const ${MatchedCode[0]} = "${config.Misc.id}"`);
    }

    const GlobalEnv = await GetGlobalEnv();

    beforeCode.push(`window = {}`);
    beforeCode.push(GlobalEnv);

    const code = beautified.slice(start, end);
    const keys = Object.keys(freezeCalls);
    const newCode = code.replace(keys[0] + " = Object.fre", "FirstRoutes = Object.fre").replace(keys[1] + " = Object.fre", "SecondRoutes = Object.fre");

    term.yellow("\nReplaced");
    console.log(newCode);

    // just some fake location code in case it gets used
    const fakeLocationCode = `const location = { protocol: "https", host: "discord.com", pathname: "/api/v9" };`;
    fs.writeFileSync(path.join(__dirname, "../saves/Routes.js"), beforeCode.join(";") + ";" + `${fakeLocationCode}const FirstRoutes = ${newCode};module.exports = { FirstRoutes, ${keys.length > 1 ? "SecondRoutes" : ""} }`, "utf8");
})();