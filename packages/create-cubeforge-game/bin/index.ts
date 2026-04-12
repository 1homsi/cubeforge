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
    const destName = entry.name.endsWith('.template') ? entry.name.slice(0, -'.template'.length) : entry.name
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

const TEMPLATES = ['default', 'puzzle', 'turn-based', 'editor'] as const
type Template = (typeof TEMPLATES)[number]

const TEMPLATE_DESCRIPTIONS: Record<Template, string> = {
  default: 'Action platformer with physics, coins, and save/load',
  puzzle: 'Grid-based sliding puzzle (onDemand loop, drag-and-snap, undo/redo)',
  'turn-based': 'Tic-tac-toe with turn manager, hover, and accessibility',
  editor: 'Scene editor with selection, transform handles, save/load',
}

function parseArgs(): { projectName: string | undefined; template: Template | undefined } {
  const args = process.argv.slice(2)
  let projectName: string | undefined
  let template: Template | undefined
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--template' || a === '-t') {
      const next = args[++i]
      if (!next || !(TEMPLATES as readonly string[]).includes(next)) {
        process.stderr.write(`Error: --template must be one of: ${TEMPLATES.join(', ')}\n`)
        process.exit(1)
      }
      template = next as Template
    } else if (a.startsWith('--template=')) {
      const val = a.slice('--template='.length)
      if (!(TEMPLATES as readonly string[]).includes(val)) {
        process.stderr.write(`Error: --template must be one of: ${TEMPLATES.join(', ')}\n`)
        process.exit(1)
      }
      template = val as Template
    } else if (!projectName) {
      projectName = a
    }
  }
  return { projectName, template }
}

async function main(): Promise<void> {
  let { projectName, template } = parseArgs()

  if (!projectName) {
    projectName = await prompt('Project name: ')
  }

  if (!projectName) {
    process.stderr.write('Error: project name is required.\n')
    process.exit(1)
  }

  if (!template) {
    process.stdout.write('\nAvailable templates:\n')
    for (const t of TEMPLATES) {
      process.stdout.write(`  ${t.padEnd(12)} — ${TEMPLATE_DESCRIPTIONS[t]}\n`)
    }
    const answer = await prompt('\nTemplate (default): ')
    const chosen = answer || 'default'
    if (!(TEMPLATES as readonly string[]).includes(chosen)) {
      process.stderr.write(`Error: unknown template "${chosen}".\n`)
      process.exit(1)
    }
    template = chosen as Template
  }

  const targetDir = path.resolve(process.cwd(), projectName)

  if (fs.existsSync(targetDir)) {
    process.stderr.write(`Error: directory "${projectName}" already exists.\n`)
    process.exit(1)
  }

  const templatesDir = path.join(import.meta.dirname, '..', 'templates', template)
  if (!fs.existsSync(templatesDir)) {
    process.stderr.write(`Error: template "${template}" not found at ${templatesDir}\n`)
    process.exit(1)
  }

  process.stdout.write(`\nCreating new Cubeforge game in ${targetDir} (template: ${template})...\n`)
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
