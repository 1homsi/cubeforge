import { describe, it, expect } from 'vitest'
import { mkdtempSync, readdirSync, readFileSync, existsSync, statSync, rmSync } from 'fs'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
import { execFileSync } from 'child_process'

const TEMPLATES_ROOT = resolve(__dirname, '..')
const CLI_BIN = resolve(__dirname, '..', '..', 'bin', 'index.js')
const TEMPLATE_NAMES = ['default', 'puzzle', 'turn-based', 'editor']

function collectTemplateFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectTemplateFiles(fullPath))
    } else if (entry.name.endsWith('.template')) {
      results.push(fullPath)
    }
  }
  return results
}

describe.each(TEMPLATE_NAMES)('%s template', (name) => {
  const dir = join(TEMPLATES_ROOT, name)

  it('template directory exists', () => {
    expect(existsSync(dir)).toBe(true)
    expect(statSync(dir).isDirectory()).toBe(true)
  })

  it('contains at least one .template file', () => {
    const files = collectTemplateFiles(dir)
    expect(files.length).toBeGreaterThan(0)
  })

  it('all .template files are non-empty', () => {
    for (const filePath of collectTemplateFiles(dir)) {
      const content = readFileSync(filePath, 'utf-8')
      expect(content.trim().length, `expected ${filePath} to be non-empty`).toBeGreaterThan(0)
    }
  })

  it('package.json.template has lint script', () => {
    const pkgPath = join(dir, 'package.json.template')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.scripts.lint).toBeDefined()
    expect(pkg.scripts.lint).toContain('eslint')
  })

  it('package.json.template has format script', () => {
    const pkgPath = join(dir, 'package.json.template')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.scripts.format).toBeDefined()
    expect(pkg.scripts.format).toContain('prettier')
  })

  it('includes eslint config template', () => {
    expect(existsSync(join(dir, '.eslintrc.cjs.template'))).toBe(true)
  })

  it('includes prettier config template', () => {
    expect(existsSync(join(dir, '.prettierrc.template'))).toBe(true)
  })

  it('tsconfig.json.template enables strict mode', () => {
    const tsconfig = JSON.parse(readFileSync(join(dir, 'tsconfig.json.template'), 'utf-8'))
    expect(tsconfig.compilerOptions.strict).toBe(true)
  })

  it('has an App.tsx.template and main.tsx.template', () => {
    expect(existsSync(join(dir, 'src', 'App.tsx.template'))).toBe(true)
    expect(existsSync(join(dir, 'src', 'main.tsx.template'))).toBe(true)
  })
})

describe('create-cubeforge-game CLI', () => {
  it('keeps display names while generating npm-safe package names', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'create-cubeforge-game-'))

    try {
      execFileSync(process.execPath, [CLI_BIN, 'My Game', '--template', 'puzzle'], {
        cwd: tmp,
        stdio: 'pipe',
      })

      const projectDir = join(tmp, 'My Game')
      const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'))
      const html = readFileSync(join(projectDir, 'index.html'), 'utf-8')

      expect(pkg.name).toBe('my-game')
      expect(html).toContain('<title>My Game</title>')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('escapes display names for generated code, HTML, and shell commands', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'create-cubeforge-game-'))
    const projectName = "Odd Name's `ticks` ${HOME} & Co"

    try {
      const output = execFileSync(process.execPath, [CLI_BIN, projectName, '--template', 'editor'], {
        cwd: tmp,
        encoding: 'utf-8',
        stdio: 'pipe',
      })

      const projectDir = join(tmp, projectName)
      const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'))
      const html = readFileSync(join(projectDir, 'index.html'), 'utf-8')
      const app = readFileSync(join(projectDir, 'src', 'App.tsx'), 'utf-8')
      const projectNameTsString = JSON.stringify(projectName)

      expect(pkg.name).toBe('odd-name-s-ticks-home-co')
      expect(html).toContain("<title>Odd Name&#39;s `ticks` ${HOME} &amp; Co</title>")
      expect(app).toContain(`const STORAGE_KEY = ${projectNameTsString} + ':scene'`)
      expect(app).toContain(`downloadCanvas(engine.canvas, ${projectNameTsString} + '.png')`)
      expect(app).toContain(`>{ ${projectNameTsString} }</h1>`)
      expect(app).not.toContain('{{PROJECT_NAME')
      expect(html).not.toContain('{{PROJECT_NAME')
      expect(output).toContain("  cd 'Odd Name'\\''s `ticks` ${HOME} & Co'\n")
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('prints an unambiguous cd command for names that look like options', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'create-cubeforge-game-'))
    const projectName = '-starter'

    try {
      const output = execFileSync(process.execPath, [CLI_BIN, projectName, '--template', 'puzzle'], {
        cwd: tmp,
        encoding: 'utf-8',
        stdio: 'pipe',
      })

      expect(output).toContain('  cd -- -starter\n')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
