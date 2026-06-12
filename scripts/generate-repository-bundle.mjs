import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const OUTPUT_DIRECTORY = path.join(ROOT, '.orb-source')
const OUTPUT_PATH = path.join(OUTPUT_DIRECTORY, 'repository.json')
const ALLOWED_DIRECTORIES = ['app', 'components', 'docs', 'lib', 'scripts']
const ALLOWED_ROOT_FILES = ['package.json', 'tsconfig.json']
const ALLOWED_EXTENSIONS = new Set([
  '.css', '.cjs', '.js', '.json', '.md', '.mjs', '.sql', '.ts', '.tsx', '.yaml', '.yml',
])
const MAX_FILE_BYTES = 250_000

const files = {}

function addFile(relativePath) {
  if (relativePath.startsWith('.orb-source/')) return
  if (!ALLOWED_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) return

  const fullPath = path.join(ROOT, relativePath)
  const stats = fs.lstatSync(fullPath)
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_FILE_BYTES) return
  files[relativePath] = fs.readFileSync(fullPath, 'utf8')
}

function walk(relativePath) {
  const fullPath = path.join(ROOT, relativePath)
  const stats = fs.lstatSync(fullPath)
  if (stats.isSymbolicLink()) return
  if (stats.isFile()) {
    addFile(relativePath)
    return
  }

  for (const entry of fs.readdirSync(fullPath, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    walk(path.posix.join(relativePath, entry.name))
  }
}

for (const directory of ALLOWED_DIRECTORIES) walk(directory)
for (const file of ALLOWED_ROOT_FILES) addFile(file)

fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true })
fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
  generated_at: new Date().toISOString(),
  files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
}))

console.log(`Generated production repository bundle with ${Object.keys(files).length} files`)
