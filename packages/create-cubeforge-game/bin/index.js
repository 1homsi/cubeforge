#!/usr/bin/env node

// bin/index.ts
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
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
    process.stderr.write(`Error: project name is required.
`);
    process.exit(1);
  }
  const targetDir = path.resolve(process.cwd(), projectName);
  if (fs.existsSync(targetDir)) {
    process.stderr.write(`Error: directory "${projectName}" already exists.
`);
    process.exit(1);
  }
  const templatesDir = path.join(import.meta.dirname, "..", "templates", "default");
  process.stdout.write(`
Creating new Cubeforge game in ${targetDir}...
`);
  copyTemplateDir(templatesDir, targetDir, projectName);
  process.stdout.write(`
Done! Your project "${projectName}" is ready.
`);
  process.stdout.write(`
Next steps:
`);
  process.stdout.write(`  cd ${projectName}
`);
  process.stdout.write(`  npm install   # or bun install
`);
  process.stdout.write(`  npm run dev   # or bun dev

`);
}
main().catch((err) => {
  process.stderr.write(`Unexpected error: ${String(err)}
`);
  process.exit(1);
});
