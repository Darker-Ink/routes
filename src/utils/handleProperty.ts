import type { CallExpression, Property } from "acorn";
import { inspect } from "bun";

const handleCallExpression = (data: CallExpression) => {
    if (data.type !== "CallExpression" || data.callee.type !== "MemberExpression") {
        console.log(`Invalid data type, expected CallExpression and MemberExpression, got ${data.type}, ${"callee" in data ? data.callee.type : "undefined"}`);

        return null;
    }

    let path = "";
    const args: string[] = [];

    if (data.callee.object.type === "Literal") {
        path += data.callee.object.value;

        for (const arg of data.arguments) {
            if (arg.type !== "Literal") {
                args.push(":arg");

                continue;
            }

            args.push(arg.value?.toString() ?? "");
        }
    }

    return {
        path,
        args
    }
}

const handleProperty = (data: Property) => {
    if (data.key.type !== "Identifier") {
        console.log(`Invalid data key type, expected Identifier, got ${data.key.type}`);

        return null;
    }


    switch (data.value.type) {
        case "FunctionExpression":
        case "ArrowFunctionExpression": {
            const key = data.key.name;

            let path = "";
            const args: string[] = [];

            if (data.value.type === "ArrowFunctionExpression") {

                if (data.value.body.type === "Literal") {
                    path += data.value.body.value;

                    return {
                        key,
                        path,
                        args
                    }
                }

                if (data.value.body.type === "ConditionalExpression") {
                    const consequent = data.value.body.consequent.type === "CallExpression" ? handleCallExpression(data.value.body.consequent) : data.value.body.consequent.type === "Literal" ? {
                        path: data.value.body.consequent.value,
                        args: []
                    } : {
                        path: null,
                        args: []
                    };
                    const alternate = data.value.body.alternate.type === "CallExpression" ? handleCallExpression(data.value.body.alternate) : data.value.body.alternate.type === "Literal" ? {
                        path: data.value.body.alternate.value,
                        args: []
                    } : {
                        path: null,
                        args: []
                    };

                    if (!consequent?.path || !alternate?.path) {
                        console.log(`[${key}] Failed to parse conditional expression, skipping...`);

                        return null;
                    }

                    console.log(`[${key}] Parsed conditional expression, got ${consequent.path} (${consequent.args.join("/")}) and ${alternate.path} (${alternate.args.join("/")})`);

                    return null;
                }

                if (data.value.body.type !== "CallExpression" || data.value.body.callee.type !== "MemberExpression") {
                    console.warn(`[${key}] Invalid data value body type, expected CallExpression and MemberExpression, got ${data.value.body.type}, ${"callee" in data.value.body ? data.value.body.callee.type : "undefined"} `);

                    if (data.value.body.type === "BlockStatement") {
                        console.log(inspect(data, {
                            colors: true,
                            depth: 50
                        }))
                    }

                    return null;
                }

                // path += endpoint.value.body.callee.object.value

                // console.log(endpoint.value.body.arguments.length)

                if (data.value.body.callee.object.type === "Literal") {
                    path += data.value.body.callee.object.value;

                    for (const _ of data.value.body.arguments) {
                        args.push(":arg");
                    }
                }

                if (data.value.body.callee.object.type === "MemberExpression") {
                    console.log(inspect(data, {
                        colors: true,
                        depth: 50
                    }))
                }
            }

            return {
                key,
                path,
                args
            }
        }

        case "Literal": {
            return {
                key: data.key.name,
                path: data.value.value?.toString() ?? "",
                args: []
            }
        }

        default: {
            console.log(`Invalid data value type, expected Literal, got ${data.value.type}`);

            return null;
        }
    }

}

export default handleProperty;