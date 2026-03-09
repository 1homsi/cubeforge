import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'

const TEMPLATE_DIR = resolve(__dirname, '../default')

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

describe('project template', () => {
  const templateFiles = collectTemplateFiles(TEMPLATE_DIR)

  it('contains at least one .template file', () => {
    expect(templateFiles.length).toBeGreaterThan(0)
  })

  it.each(templateFiles.map((f) => [f.replace(TEMPLATE_DIR + '/', ''), f]))(
    '%s exists and is non-empty',
    (_name, filePath) => {
      expect(existsSync(filePath)).toBe(true)
      const content = readFileSync(filePath, 'utf-8')
      expect(content.trim().length).toBeGreaterThan(0)
    },
  )

  it('package.json.template has lint script', () => {
    const pkgPath = join(TEMPLATE_DIR, 'package.json.template')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.scripts.lint).toBeDefined()
    expect(pkg.scripts.lint).toContain('eslint')
  })

  it('package.json.template has format script', () => {
    const pkgPath = join(TEMPLATE_DIR, 'package.json.template')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.scripts.format).toBeDefined()
    expect(pkg.scripts.format).toContain('prettier')
  })

  it('includes eslint config template', () => {
    expect(existsSync(join(TEMPLATE_DIR, '.eslintrc.cjs.template'))).toBe(true)
  })

  it('includes prettier config template', () => {
    expect(existsSync(join(TEMPLATE_DIR, '.prettierrc.template'))).toBe(true)
  })

  it('tsconfig.json.template enables strict mode', () => {
    const tsconfig = JSON.parse(
      readFileSync(join(TEMPLATE_DIR, 'tsconfig.json.template'), 'utf-8'),
    )
    expect(tsconfig.compilerOptions.strict).toBe(true)
  })
})
