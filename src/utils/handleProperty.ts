import type { BlockStatement, CallExpression, Expression, Node, Property } from "acorn";
import { inspect } from "bun";
import { parseConditionalExpression } from "./handleUnknown.ts";

interface Result {
    endpoint: string;
    raw: string;
    params: string[];
}

const extractEndpoint = (node: Expression | BlockStatement): Result => {
    let endpoint = "";
    let raw = "";
    let params: string[] = [];

    const processNode = (node: Expression | BlockStatement): { endpointPart: string, rawPart: string; } => {
        switch (node.type) {
            case "CallExpression": {
                if (node.callee && node.callee.type === "MemberExpression") {
                    const objectStrings = processNode(node.callee.object as Expression);
                    const argsStrings = node.arguments?.map(arg => processNode(arg as Expression));
                    const argsEndpoint = argsStrings?.map(arg => arg.endpointPart).join('') || '';
                    const argsRaw = argsStrings?.map(arg => arg.rawPart).join('') || '';
                    return { endpointPart: objectStrings.endpointPart + argsEndpoint, rawPart: objectStrings.rawPart + argsRaw };
                }
                break;
            }

            case "Literal": {
                return { endpointPart: node.value as string, rawPart: node.value as string };
            }

            case "Identifier": {
                params.push(node.name as string);

                return { endpointPart: `:arg`, rawPart: "" };
            }

            case "LogicalExpression": {
                // @ts-expect-error -- it's fine
                const paramName = node.left?.name || node.right?.name;

                params.push(paramName as string);

                return { endpointPart: `:arg`, rawPart: "" };
            }

            case "ConditionalExpression": {
                const testStrings = processNode(node.test as Expression);
                const consequentStrings = processNode(node.consequent as Expression);
                const alternateStrings = processNode(node.alternate as Expression);
                return testStrings.endpointPart ? consequentStrings : alternateStrings;
            }

            case "BinaryExpression": {
                const leftStrings = processNode(node.left as Expression);
                const rightStrings = processNode(node.right as Expression);
                return { endpointPart: leftStrings.endpointPart + rightStrings.endpointPart, rawPart: leftStrings.rawPart + rightStrings.rawPart };
            }

            case "MemberExpression": {
                const objectStrings = processNode(node.object as Expression);
                const propertyStrings = processNode(node.property as Expression);
                return { endpointPart: objectStrings.endpointPart + propertyStrings.endpointPart, rawPart: objectStrings.rawPart + propertyStrings.rawPart };
            }

            case "BlockStatement": {
                if (Array.isArray(node.body)) {
                    for (const bodyNode of node.body) {
                        switch (bodyNode.type) {
                            case "VariableDeclaration":
                                for (const declaration of bodyNode.declarations) {
                                    if (declaration.type === "VariableDeclarator" && declaration.init) {
                                        return processNode(declaration.init);
                                    }
                                }
                                break;

                            case "ReturnStatement":
                                if (bodyNode.argument) {
                                    return processNode(bodyNode.argument);
                                }
                                break;
                        }
                    }
                }
                break;
            }

            default: {
                return { endpointPart: "", rawPart: "" };
            }
        }
        return { endpointPart: "", rawPart: "" };
    };

    const result = processNode(node);
    endpoint = result.endpointPart;
    raw = result.rawPart;

    return { endpoint, raw, params };
};

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
        args,
    };
};

const handleProperty = (data: Property): {
    key: string;
    path: string | {
        path: string;
        args: string[];
    }[];
    args?: string[];
} | null => {
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
                    };
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
                        const parsed = parseConditionalExpression(data.value.body);

                        if (!parsed) {
                            console.log(`[${key}] Failed to parse conditional expression, skipping...`);

                            return null;
                        }

                        return {
                            key,
                            path: [{
                                path: parsed.truthy,
                                args: []
                            }, {
                                path: parsed.falsey,
                                args: []
                            }],
                            args: []
                        }
                    }

                    return {
                        key,
                        path: [
                            {
                                path: consequent.path as string,
                                args: consequent.args
                            },
                            {
                                path: alternate.path as string,
                                args: alternate.args
                            }
                        ],
                        args: []
                    };
                }

                if (data.value.body.type !== "CallExpression" || data.value.body.callee.type !== "MemberExpression") {
                    if (data.value.body.type === "BlockStatement" || data.value.body.type === "BinaryExpression") {
                        const parsed = extractEndpoint(data.value.body);

                        return {
                            key,
                            path: parsed.endpoint,
                            args: []
                        };
                    }

                    console.warn(`[${key}] Invalid data value body type, expected CallExpression and MemberExpression, got ${data.value.body.type}, ${"callee" in data.value.body ? data.value.body.callee.type : "undefined"} `);

                    return null;
                }

                if (data.value.body.callee.object.type === "Literal") {
                    path += data.value.body.callee.object.value;

                    for (const arg of data.value.body.arguments) {
                        if (arg.type === "Literal" && typeof arg?.value === "string") args.push(arg.value.length > 1 ? arg.value : ":arg");
                        else args.push(":arg");
                    }
                }

                if (data.value.body.callee.object.type === "MemberExpression") {
                    console.log(inspect(data, {
                        colors: true,
                        depth: 50
                    }));
                }

                const parsed = extractEndpoint(data.value.body)

                if (parsed) {
                    return {
                        key,
                        path: parsed.endpoint,
                        args: []
                    }
                }
            } else if (data.value.type === "FunctionExpression") {
                const foundReturn = data.value.body.body.find((bodyNode) => bodyNode.type === "ReturnStatement");

                if (foundReturn && foundReturn.type === "ReturnStatement" && foundReturn.argument?.type === "CallExpression") {
                    const extracted = extractEndpoint(foundReturn.argument);

                    return {
                        key,
                        path: extracted.endpoint,
                        args: []
                    }
                }
            }

            if (path === "") {
                console.log(`[${key}] Failed to parse path, :/`);

                console.log(inspect(data, {
                    colors: true,
                    depth: 50
                }))
            }

            return {
                key,
                path,
                args
            };
        }

        case "Literal": {
            return {
                key: data.key.name,
                path: data.value.value?.toString() ?? "",
                args: []
            };
        }

        case "ConditionalExpression": {
            if (data.type === "Property" && data.value && data.value.type === "ConditionalExpression") {
                const conditionalNode = data.value;
                if (conditionalNode.consequent && conditionalNode.alternate) {
                    const truthy = conditionalNode.consequent.type === "Literal" ? conditionalNode.consequent.value : null;
                    const falsy = conditionalNode.alternate.type === "Literal" ? conditionalNode.alternate.value : null;

                    if (truthy && falsy) {
                        return {
                            key: data.key.name,
                            path: [
                                {
                                    path: truthy as string,
                                    args: []
                                },
                                {
                                    path: falsy as string,
                                    args: []
                                }
                            ],
                            args: []
                        };
                    }
                }
            }


            break;
        }

        default: {
            console.log(`[${data.key.name}] Invalid data value type, expected Literal, got ${data.value.type}`);

            return null;
        }
    }

    return null;
};

export default handleProperty;