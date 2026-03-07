#!/usr/bin/env node
#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// bin/index.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var readline = __toESM(require("readline"));
var import_meta = {};
function prompt(question) {
  return new Promise((resolve2) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve2(answer.trim());
    });
  });
}
function copyTemplateDir(src, dest, projectName) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destName = entry.name.endsWith(".template") ? entry.name.slice(0, -".template".length) : entry.name;
    const destPath = path.join(dest, destName);
    if (entry.isDirectory()) {
      copyTemplateDir(srcPath, destPath, projectName);
    } else {
      const content = fs.readFileSync(srcPath, "utf8");
      const replaced = content.replaceAll("{{PROJECT_NAME}}", projectName);
      fs.writeFileSync(destPath, replaced, "utf8");
    }
  }
}
async function main() {
  let projectName = process.argv[2];
  if (!projectName) {
    projectName = await prompt("Project name: ");
  }
  if (!projectName) {
    process.stderr.write("Error: project name is required.\n");
    process.exit(1);
  }
  const targetDir = path.resolve(process.cwd(), projectName);
  if (fs.existsSync(targetDir)) {
    process.stderr.write(`Error: directory "${projectName}" already exists.
`);
    process.exit(1);
  }
  const templatesDir = path.join(import_meta.dirname, "..", "templates", "default");
  process.stdout.write(`
Creating new Cubeforge game in ${targetDir}...
`);
  copyTemplateDir(templatesDir, targetDir, projectName);
  process.stdout.write(`
Done! Your project "${projectName}" is ready.
`);
  process.stdout.write("\nNext steps:\n");
  process.stdout.write(`  cd ${projectName}
`);
  process.stdout.write("  npm install   # or bun install\n");
  process.stdout.write("  npm run dev   # or bun dev\n\n");
}
main().catch((err) => {
  process.stderr.write(`Unexpected error: ${String(err)}
`);
  process.exit(1);
});
