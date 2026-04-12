import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'fs'
import { join, resolve } from 'path'

const TEMPLATES_ROOT = resolve(__dirname, '..')
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
