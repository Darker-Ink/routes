import { Expression, parse } from "acorn";
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
        [key: string]: string
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

        finishedEndpoints[parsed.key] = parsed.path + parsed.args.join("/");
    }

    const finishedRoutes: {
        [key: string]: string
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

        finishedRoutes[parsed.key] = parsed.path + parsed.args.join("/");
    }

    return {
        endpoints: finishedEndpoints,
        routes: finishedRoutes
    }
}

export default walk;