#!/usr/bin/env node
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function copyTemplateDir(src: string, dest: string, projectName: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    // Strip .template extension for destination file name
    const destName = entry.name.endsWith('.template')
      ? entry.name.slice(0, -'.template'.length)
      : entry.name
    const destPath = path.join(dest, destName)
    if (entry.isDirectory()) {
      copyTemplateDir(srcPath, destPath, projectName)
    } else {
      const content = fs.readFileSync(srcPath, 'utf8')
      const replaced = content.replaceAll('{{PROJECT_NAME}}', projectName)
      fs.writeFileSync(destPath, replaced, 'utf8')
    }
  }
}

async function main(): Promise<void> {
  let projectName = process.argv[2]

  if (!projectName) {
    projectName = await prompt('Project name: ')
  }

  if (!projectName) {
    process.stderr.write('Error: project name is required.\n')
    process.exit(1)
  }

  const targetDir = path.resolve(process.cwd(), projectName)

  if (fs.existsSync(targetDir)) {
    process.stderr.write(`Error: directory "${projectName}" already exists.\n`)
    process.exit(1)
  }

  const templatesDir = path.join(import.meta.dirname, '..', 'templates', 'default')

  process.stdout.write(`\nCreating new Cubeforge game in ${targetDir}...\n`)
  copyTemplateDir(templatesDir, targetDir, projectName)

  process.stdout.write(`\nDone! Your project "${projectName}" is ready.\n`)
  process.stdout.write('\nNext steps:\n')
  process.stdout.write(`  cd ${projectName}\n`)
  process.stdout.write('  npm install   # or bun install\n')
  process.stdout.write('  npm run dev   # or bun dev\n\n')
}

main().catch((err: unknown) => {
  process.stderr.write(`Unexpected error: ${String(err)}\n`)
  process.exit(1)
})
