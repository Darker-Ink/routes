import { js_beautify } from "js-beautify";
import { simple } from "acorn-walk";
import { parse } from "acorn";

const cleaner = async (code: string) => {
    const beautified = js_beautify(code, {
        "indent_size": 4,
        "indent_char": " ",
        "max_preserve_newlines": 5,
        "preserve_newlines": true,
        "keep_array_indentation": false,
        "break_chained_methods": false,
        "brace_style": "collapse",
        "space_before_conditional": true,
        "unescape_strings": false,
        "jslint_happy": false,
        "end_with_newline": false,
        "wrap_line_length": 0,
        "comma_first": false,
        "e4x": false,
        "indent_empty_lines": false
    });

    const parsed = parse(beautified, {
        ecmaVersion: 2020,
    });

    const checkRoutes = [["BILLING_PREFIX", "/billing"], ["FRIENDS", "/channels/@me"], ["LOGIN", "/login"], ["ACTIVITIES", "/activities"], ["USERS", "/users"], ["ME", "/users/@me"]];
    const freezeCalls: {
        start: number;
        end: number
    }[] = []

    simple(parsed, {
        CallExpression: (node) => {
            if (node.callee.type === "MemberExpression" && node.callee.property.type === "Identifier" && node.callee.property.name === "freeze") {
                if (node.arguments[0]?.type === "ObjectExpression") {
                    const args = node.arguments[0];

                    const isCorrectObject = args.properties.some((prop) => {
                        if (prop.type !== "Property") return false;
                        
                        return checkRoutes.some((stuff) => {
                            if (prop.key.type !== "Identifier" || prop.value.type !== "Literal") return false;

                            return stuff[0] === prop.key.name && stuff[1] === prop.value.value;
                        })
                    });

                    if (isCorrectObject) {
                        freezeCalls.push({
                            start: node.start,
                            end: node.end
                        });
                    }
                }
            }
        }
    })

    let start = -1;
    let end = -1;

    for (const frozen of freezeCalls) {
        if (start === -1) {
            start = frozen.start;
        }

        end = frozen.end;
    }

    const cleaned = beautified.slice(start, end);

    return cleaned;
}

export default cleaner;