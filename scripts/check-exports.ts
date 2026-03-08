/**
 * check-exports.ts
 * Parses packages/react/src/index.ts, extracts all exported names,
 * and checks if each has a corresponding doc page in docs/api/.
 * Run via: pnpm check-exports
 */

import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const indexSrc = readFileSync(resolve(root, 'packages/react/src/index.ts'), 'utf-8')
const docFiles = readdirSync(resolve(root, 'docs/api'))

// Extract exported identifiers (functions, types, classes)
const exportPattern = /export\s+(?:(?:type\s+)?(?:\{[^}]+\}|function\s+(\w+)|class\s+(\w+)|const\s+(\w+)))/g
const namedExports: string[] = []

for (const line of indexSrc.split('\n')) {
  // Capture bare named exports: export { Foo, Bar } from '...'
  const braceMatch = line.match(/^export\s+(?:type\s+)?\{([^}]+)\}/)
  if (braceMatch) {
    for (const name of braceMatch[1].split(',')) {
      const trimmed = name.trim().split(/\s+as\s+/).pop()?.trim()
      if (trimmed) namedExports.push(trimmed)
    }
  }
}

// Build doc slug set (filename without .md, lowercased)
const docSlugs = new Set(docFiles.map(f => f.replace(/\.md$/, '').toLowerCase()))

// Map export names to expected doc slugs
function toDocSlug(name: string): string {
  // PascalCase → kebab-case, camelCase → kebab-case
  return name
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '')
}

let missing = 0
let covered = 0

console.log('\n📋 Export Coverage Report\n')

for (const name of namedExports) {
  if (name.startsWith('type ')) continue // skip re-exported types that aren't hooks/components
  const slug = toDocSlug(name)
  if (docSlugs.has(slug) || docSlugs.has(slug.replace(/^use-/, 'use-'))) {
    covered++
  } else {
    console.log(`  ⚠️  ${name} → docs/api/${slug}.md (missing)`)
    missing++
  }
}

console.log(`\n  ✅ ${covered} exports have doc pages`)
if (missing > 0) {
  console.log(`  ⚠️  ${missing} exports are missing doc pages\n`)
} else {
  console.log('  🎉 All exports have doc pages!\n')
}
