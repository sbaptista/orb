import fs from 'fs'
import path from 'path'

export type RepositorySource = 'local' | 'production'
export type RepositoryOperation = 'list' | 'search' | 'read'

export type RepositoryQuery = {
  source?: RepositorySource
  operation: RepositoryOperation
  path?: string
  query?: string
  start_line?: number
  end_line?: number
  max_results?: number
}

type RepositoryQueryContext = {
  userId: string
  canInspectRepository: boolean
}

const PRODUCTION_ORIGIN = process.env.ORB_PRODUCTION_URL || 'https://orb-eight-lake.vercel.app'
const ALLOWED_DIRECTORIES = ['app', 'components', 'docs', 'lib', 'scripts']
const ALLOWED_ROOT_FILES = new Set(['package.json', 'tsconfig.json'])
const PRODUCTION_BUNDLE_PATH = path.join(process.cwd(), '.orb-source', 'repository.json')
const ALLOWED_EXTENSIONS = new Set([
  '.css', '.cjs', '.js', '.json', '.md', '.mjs', '.sql', '.ts', '.tsx', '.yaml', '.yml',
])
const MAX_FILE_BYTES = 250_000
const MAX_READ_LINES = 400
const DEFAULT_RESULTS = 30
const MAX_RESULTS = 100
const PRODUCTION_REQUEST_TIMEOUT_MS = 15_000

function normalizeRelativePath(input = ''): string {
  const normalized = input.replaceAll('\\', '/').replace(/^\.\/+/, '').replace(/\/+$/, '')
  if (normalized.includes('\0') || path.posix.isAbsolute(normalized)) {
    throw new Error('Repository path must be relative')
  }

  const segments = normalized.split('/').filter(Boolean)
  if (segments.some(segment => segment === '..' || segment.startsWith('.'))) {
    throw new Error('Repository path is outside the readable source tree')
  }

  if (segments.length === 0) return ''
  if (segments.length === 1 && ALLOWED_ROOT_FILES.has(segments[0])) return normalized
  if (!ALLOWED_DIRECTORIES.includes(segments[0])) {
    throw new Error(`Readable paths are limited to: ${[...ALLOWED_DIRECTORIES, ...ALLOWED_ROOT_FILES].join(', ')}`)
  }
  return normalized
}

function isReadableFile(relativePath: string): boolean {
  const segments = relativePath.split('/')
  if (segments.some(segment => segment.startsWith('.'))) return false
  if (!ALLOWED_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) return false

  const topLevel = segments[0]
  return ALLOWED_DIRECTORIES.includes(topLevel) || ALLOWED_ROOT_FILES.has(relativePath)
}

function absolutePath(relativePath: string): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), relativePath)
}

function localReadableFiles(relativeDirectory = ''): string[] {
  if (relativeDirectory && ALLOWED_ROOT_FILES.has(relativeDirectory)) {
    return fs.existsSync(absolutePath(relativeDirectory)) ? [relativeDirectory] : []
  }

  const roots = relativeDirectory ? [relativeDirectory] : [...ALLOWED_DIRECTORIES, ...ALLOWED_ROOT_FILES]
  const files: string[] = []

  function walk(relativePath: string) {
    const fullPath = absolutePath(relativePath)
    let stats: fs.Stats
    try {
      stats = fs.lstatSync(fullPath)
    } catch {
      return
    }

    if (stats.isSymbolicLink()) return
    if (stats.isFile()) {
      if (isReadableFile(relativePath) && stats.size <= MAX_FILE_BYTES) files.push(relativePath)
      return
    }
    if (!stats.isDirectory()) return

    for (const entry of fs.readdirSync(fullPath, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      walk(path.posix.join(relativePath, entry.name))
    }
  }

  roots.forEach(walk)
  return files.sort()
}

function productionBundle(): Record<string, string> {
  const parsed = JSON.parse(fs.readFileSync(PRODUCTION_BUNDLE_PATH, 'utf8'))
  return parsed.files ?? {}
}

function productionReadableFiles(relativeDirectory = ''): string[] {
  const prefix = relativeDirectory ? `${relativeDirectory}/` : ''
  return Object.keys(productionBundle())
    .filter(file => file === relativeDirectory || file.startsWith(prefix))
    .sort()
}

function clampResults(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RESULTS
  return Math.min(MAX_RESULTS, Math.max(1, Math.floor(value!)))
}

function executeRepositoryQuery(input: RepositoryQuery, source: RepositorySource) {
  const relativePath = normalizeRelativePath(input.path)
  const maxResults = clampResults(input.max_results)
  const bundledFiles = source === 'production' ? productionBundle() : null
  const readableFiles = source === 'production' ? productionReadableFiles : localReadableFiles
  const readFile = (file: string) => bundledFiles ? bundledFiles[file] : fs.readFileSync(absolutePath(file), 'utf8')

  if (input.operation === 'list') {
    const files = readableFiles(relativePath)
    return {
      source,
      path: relativePath || '.',
      files: files.slice(0, maxResults),
      total: files.length,
      truncated: files.length > maxResults,
    }
  }

  if (input.operation === 'search') {
    const needle = input.query?.trim().toLowerCase()
    if (!needle) throw new Error('query is required for repository search')

    const matches: Array<{ path: string; line: number; text: string }> = []
    for (const file of readableFiles(relativePath)) {
      const lines = readFile(file).split(/\r?\n/)
      for (let index = 0; index < lines.length; index += 1) {
        if (lines[index].toLowerCase().includes(needle)) {
          matches.push({ path: file, line: index + 1, text: lines[index].trim().slice(0, 500) })
          if (matches.length >= maxResults) break
        }
      }
      if (matches.length >= maxResults) break
    }

    return {
      source,
      query: input.query,
      path: relativePath || '.',
      matches,
      truncated: matches.length >= maxResults,
    }
  }

  if (input.operation === 'read') {
    if (!relativePath || !isReadableFile(relativePath)) throw new Error('A readable file path is required')
    if (source === 'local') {
      const stats = fs.lstatSync(absolutePath(relativePath))
      if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_FILE_BYTES) {
        throw new Error('File is unavailable or exceeds the 250 KB read limit')
      }
    } else if (!bundledFiles?.[relativePath]) {
      throw new Error('File is unavailable in this production deployment')
    }

    const lines = readFile(relativePath).split(/\r?\n/)
    const startLine = Math.min(lines.length || 1, Math.max(1, Math.floor(input.start_line || 1)))
    const requestedEnd = Math.floor(input.end_line || startLine + MAX_READ_LINES - 1)
    const endLine = Math.min(lines.length, requestedEnd, startLine + MAX_READ_LINES - 1)
    const content = lines
      .slice(startLine - 1, endLine)
      .map((line, index) => `${startLine + index}: ${line}`)
      .join('\n')

    return {
      source,
      path: relativePath,
      start_line: startLine,
      end_line: endLine,
      total_lines: lines.length,
      content,
      truncated: endLine < lines.length,
    }
  }

  throw new Error(`Unsupported repository operation: ${input.operation}`)
}

export async function queryRepository(input: RepositoryQuery, context: RepositoryQueryContext) {
  if (!context.canInspectRepository) throw new Error('Repository access requires an Admin, Super Admin, or Developer role')

  const source = input.source || (process.env.NODE_ENV === 'production' ? 'production' : 'local')
  if (source === 'local') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('The local working tree is available only from localhost Orb')
    }
    return executeRepositoryQuery({ ...input, source }, 'local')
  }

  if (process.env.NODE_ENV === 'production') {
    return executeRepositoryQuery({ ...input, source }, 'production')
  }

  if (!process.env.ORB_API_SECRET) throw new Error('ORB_API_SECRET is required to inspect the production deployment')
  const response = await fetch(`${PRODUCTION_ORIGIN}/api/repository`, {
    method: 'POST',
    headers: {
      Authorization: process.env.ORB_API_SECRET,
      'Content-Type': 'application/json',
      'X-User-Id': context.userId,
    },
    body: JSON.stringify({ ...input, source: 'production' }),
    cache: 'no-store',
    signal: AbortSignal.timeout(PRODUCTION_REQUEST_TIMEOUT_MS),
  }).catch(error => {
    if (error?.name === 'TimeoutError') {
      throw new Error('Production repository request timed out after 15 seconds')
    }
    throw error
  })

  const body = await response.json()
  if (!response.ok) throw new Error(body.error || `Production repository request failed (${response.status})`)
  return body
}

export function queryBundledRepository(input: RepositoryQuery) {
  return executeRepositoryQuery({ ...input, source: 'production' }, 'production')
}
