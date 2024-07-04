import type { BlockStatement, ConditionalExpression, Expression } from "acorn";

interface ConditionalResult {
    truthy: string;
    falsey: string;
}

const extractValue = (node: Expression | BlockStatement | ConditionalExpression): string => {
    if (node.type === "Literal") {
        return node.value as string
    } else if (node.type === "CallExpression" && node.callee && node.callee.type === "MemberExpression") {
        const objectValue = extractValue(node.callee.object as Expression);
        const argsValue = node.arguments?.map(arg => extractValue(arg as Expression)).join('');
        return objectValue + argsValue;
    } else if (node.type === "ConditionalExpression") {
        const testValue = extractValue(node.test as Expression);
        const consequentValue = extractValue(node.consequent as Expression);
        const alternateValue = extractValue(node.alternate as Expression);
        return testValue ? consequentValue : alternateValue;
    } else if (node.type === "Identifier") {
        return `:${node.name && node.name.length > 2 ? node.name : 'arg'}`;
    }

    return "";
};

const parseConditionalExpression = (node: ConditionalExpression): ConditionalResult | null => {
    if (node.type === "ConditionalExpression") {
        const truthy = extractValue(node.consequent );
        const falsey = extractValue(node.alternate);
        return { truthy, falsey };
    }
    return null;
}

export { extractValue, parseConditionalExpression };