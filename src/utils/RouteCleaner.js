const dashAst = require("dash-ast");
const acorn = require("acorn");
const fs = require("fs");
const path = require("path");

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


const code = currentJs.slice(start, end);
const keys = Object.keys(freezeCalls);
const newCode = code.replace(keys[0], "FirstRoutes").replace(keys[1], "SecondRoutes");

// just some fake location code in case it gets used
const fakeLocationCode = `const location = { protocol: "https", host: "discord.com", pathname: "/api/v9" };`;
fs.writeFileSync(path.join(__dirname, "../saves/Routes.js"), beforeCode.join(";") + ";" + `${fakeLocationCode}const FirstRoutes = ${newCode};module.exports = { FirstRoutes, ${keys.length > 1 ? "SecondRoutes" : ""} }`, "utf8");
