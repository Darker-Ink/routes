const term = require('terminal-kit').terminal;
const fs = require('fs');
const path = require('path');
const WebhookUtils = require('./WebhookUtils');
const code = fs.readFileSync(path.join(__dirname, '../saves/current.js'), 'utf8');
const propertyName = "USER";

const JoinRegex = /([a-zA-Z$_][a-zA-Z0-9$_]*)\s*\.\s*JOIN\s*\)/;
const DeviceRegex = /([a-zA-Z$_][a-zA-Z0-9$_]*)\s*\.\s*g\b/;
const regex = new RegExp(`^\\s*${propertyName}:\\s*(.*)`, "m");

const match = code.match(regex);

if (!match) {
  term.red('\nObject definition not found in file');
  WebhookUtils.stats(`Object definition not found in file`);
  return;
}

const index = match.index;
let lineNumber = 1;
for (let i = 0; i < index; i++) {
  if (code[i] === "\n") {
    lineNumber++;
  }
}

const lines = code.split("\n");
let objectFreezeLine = lineNumber - 1;

while (objectFreezeLine > 0) {
  const line = lines[objectFreezeLine - 1];

  if (line.includes("Object.freeze")) {
    break;
  }

  objectFreezeLine--;
}

const objectFreezeLineText = lines[objectFreezeLine - 1];
const variableName = objectFreezeLineText.split("=")[0].trim();

const regexy = new RegExp(`${variableName}\\s*=\\s*Object\\.freeze\\(\\s*\\{[\\s\\S]*?\\}\\s*\\);`);
const match2 = code.match(regexy);

if (!match2) {
  term.red('\nObject definition not found in file');
  WebhookUtils.stats(`Object definition not found in file (2)`);
  return;
}

const ceObject = match2[0];

try {
  eval(`const m = { a: false };${ceObject}`);
} catch (e) {
  const errorLine = e.stack.split("at")[2];

  const splitErorrLine = errorLine.split(":");
  const RemoveFrom = splitErorrLine[splitErorrLine.length - 2];

  const lines = ceObject.split("\n");
  const newLines = lines.slice(0, RemoveFrom - 1);
  const UpdatedCode = newLines.join("\n").replace(/,\s*$/, "").replace(new RegExp(`\\b${variableName}\\b`, 'g'), "routes");
  const JoinCode = UpdatedCode.match(JoinRegex);
  const DeviceCode = UpdatedCode.match(DeviceRegex);

  fs.writeFileSync(path.join(__dirname, '../saves/Routes.js'), `const m={a:!1},${JoinCode[1]}={JOIN:null},${DeviceCode[0][0]}={${DeviceCode[0][2]}:{DEVICE_CODE:null}};\nconst ${UpdatedCode};\nmodule.exports = routes;`);

  term.green("\nDone!");
}