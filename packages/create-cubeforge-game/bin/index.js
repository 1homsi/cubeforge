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
function toPackageName(projectName) {
  const baseName = path.basename(path.resolve(process.cwd(), projectName));
  const normalized = baseName.trim().toLowerCase().replace(/[^a-z0-9._~-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "").replace(/^[._]+/g, "");
  return normalized || "cubeforge-game";
}
function copyTemplateDir(src, dest, projectName, packageName) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destName = entry.name.endsWith(".template") ? entry.name.slice(0, -".template".length) : entry.name;
    const destPath = path.join(dest, destName);
    if (entry.isDirectory()) {
      copyTemplateDir(srcPath, destPath, projectName, packageName);
    } else {
      const content = fs.readFileSync(srcPath, "utf8");
      const replaced = content.replaceAll("{{PROJECT_NAME}}", projectName).replaceAll("{{PACKAGE_NAME}}", packageName);
      fs.writeFileSync(destPath, replaced, "utf8");
    }
  }
}
var TEMPLATES = ["default", "puzzle", "turn-based", "editor"];
var TEMPLATE_DESCRIPTIONS = {
  default: "Action platformer with physics, coins, and save/load",
  puzzle: "Grid-based sliding puzzle (onDemand loop, drag-and-snap, undo/redo)",
  "turn-based": "Tic-tac-toe with turn manager, hover, and accessibility",
  editor: "Scene editor with selection, transform handles, save/load"
};
function parseArgs() {
  const args = process.argv.slice(2);
  let projectName;
  let template;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--template" || a === "-t") {
      const next = args[++i];
      if (!next || !TEMPLATES.includes(next)) {
        process.stderr.write(`Error: --template must be one of: ${TEMPLATES.join(", ")}
`);
        process.exit(1);
      }
      template = next;
    } else if (a.startsWith("--template=")) {
      const val = a.slice("--template=".length);
      if (!TEMPLATES.includes(val)) {
        process.stderr.write(`Error: --template must be one of: ${TEMPLATES.join(", ")}
`);
        process.exit(1);
      }
      template = val;
    } else if (!projectName) {
      projectName = a;
    }
  }
  return { projectName, template };
}
async function main() {
  let { projectName, template } = parseArgs();
  if (!projectName) {
    projectName = await prompt("Project name: ");
  }
  if (!projectName) {
    process.stderr.write("Error: project name is required.\n");
    process.exit(1);
  }
  if (!template) {
    process.stdout.write("\nAvailable templates:\n");
    for (const t of TEMPLATES) {
      process.stdout.write(`  ${t.padEnd(12)} \u2014 ${TEMPLATE_DESCRIPTIONS[t]}
`);
    }
    const answer = await prompt("\nTemplate (default): ");
    const chosen = answer || "default";
    if (!TEMPLATES.includes(chosen)) {
      process.stderr.write(`Error: unknown template "${chosen}".
`);
      process.exit(1);
    }
    template = chosen;
  }
  const targetDir = path.resolve(process.cwd(), projectName);
  const packageName = toPackageName(projectName);
  if (fs.existsSync(targetDir)) {
    process.stderr.write(`Error: directory "${projectName}" already exists.
`);
    process.exit(1);
  }
  const templatesDir = path.join(__dirname, "..", "templates", template);
  if (!fs.existsSync(templatesDir)) {
    process.stderr.write(`Error: template "${template}" not found at ${templatesDir}
`);
    process.exit(1);
  }
  process.stdout.write(`
Creating new Cubeforge game in ${targetDir} (template: ${template})...
`);
  copyTemplateDir(templatesDir, targetDir, projectName, packageName);
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
