import { type Expression, parse } from "acorn";
import { inspect } from "bun";
import handleProperty from "./handleProperty.ts";

const walk = async (code: string) => {
    const parsed = parse(code, {
        ecmaVersion: "latest",
        sourceType: "module"
    });

    const baseBody = parsed.body[0]

    if (baseBody.type !== "ExpressionStatement") {
        throw new Error("Invalid base body type");
    }

    const expression = baseBody.expression;

    if (expression.type !== "SequenceExpression") {
        throw new Error("Invalid expression type");
    }

    const endpoints = expression.expressions[0];
    const routesData = expression.expressions[1];

    if (endpoints.type !== "CallExpression" || routesData.type !== "AssignmentExpression" || routesData.right.type !== "CallExpression") {
        throw new Error(`Invalid expression type, expected CallExpression, AssignmentExpression and CallExpression, got ${endpoints.type}, ${routesData.type} and ${"right" in routesData ? routesData.right.type : "undefined"}`);
    }

    const routes = routesData.right;

    if (endpoints.callee.type !== "MemberExpression" || routes.callee.type !== "MemberExpression") {
        throw new Error("Invalid callee type");
    }

    if (endpoints.arguments[0].type !== "ObjectExpression" || routes.arguments[0].type !== "ObjectExpression") {
        throw new Error("Invalid argument type");
    }

    const finishedEndpoints: {
        [key: string]: {
            firstSeen: number;
            args: string[] | string[][];
            paths: string[];
            oldPaths: {
                paths: string;
                args: string;
                changedAt: number;
            }[]
        }
    } = {}

    for (const endpoint of endpoints.arguments[0].properties) {
        if (endpoint.type !== "Property") {
            console.log(`Invalid endpoint type, expected ObjectExpression, got ${endpoint.type}`);

            continue;
        }

        const parsed = handleProperty(endpoint);

        if (!parsed) {
            console.log("Failed to parse endpoint, skipping...");

            continue;
        }

        // finishedEndpoints[parsed.key] = (parsed.path + parsed.args.map((arg) => !arg.startsWith("/") ? `/${arg}` : arg).join("")).replaceAll(/\/{2,}/g, "/");

        finishedEndpoints[parsed.key] = {
            firstSeen: Date.now(),
            args: Array.isArray(parsed.path) ? parsed.path.map((path) => path.args) : parsed.args ?? [],
            paths: Array.isArray(parsed.path) ? parsed.path.map((path) => path.path.replaceAll(/\/{2,}/g, "/")) : [parsed.path.replaceAll(/\/{2,}/g, "/")],
            oldPaths: []
        }
    }

    const finishedRoutes: {
        [key: string]: {
            firstSeen: number;
            args: string[] | string[][];
            paths: string[];
            oldPaths: {
                paths: string;
                args: string;
                changedAt: number;
            }[]
        }
    } = {}

    for (const route of routes.arguments[0].properties) {
        if (route.type !== "Property") {
            console.log(`Invalid route type, expected ObjectExpression, got ${route.type}`);

            continue;
        }

        const parsed = handleProperty(route);

        if (!parsed) {
            console.log("Failed to parse route, skipping...");

            continue;
        }

        // finishedRoutes[parsed.key] = (parsed.path + parsed.args.map((arg) => !arg.startsWith("/") ? `/${arg}` : arg).join("")).replaceAll(/\/{2,}/g, "/");
        finishedRoutes[parsed.key] = {
            firstSeen: Date.now(),
            args: Array.isArray(parsed.path) ? parsed.path.map((path) => path.args) : parsed.args ?? [],
            paths: Array.isArray(parsed.path) ? parsed.path.map((path) => path.path.replaceAll(/\/{2,}/g, "/")) : [parsed.path.replaceAll(/\/{2,}/g, "/")],
            oldPaths: []
        }
    }

    return {
        endpoints: finishedEndpoints,
        routes: finishedRoutes
    }
}

export default walk;