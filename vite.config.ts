/// <reference types="vitest/config" />
import type { IncomingMessage, ServerResponse } from 'http'
import path from 'path'
import { execFileSync } from 'child_process'
import {
  closeSync,
  cpSync,
  createReadStream,
  fstatSync,
  mkdirSync,
  openSync,
  opendirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
  type Dirent,
} from 'fs'
import os from 'os'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import matter from 'gray-matter'

// --- Vault API middleware (dev only) ---

interface VaultEntry {
  path: string
  filename: string
  title: string
  isA: string | null
  aliases: string[]
  belongsTo: string[]
  relatedTo: string[]
  status: string | null
  archived: boolean
  trashed: boolean
  trashedAt: number | null
  modifiedAt: number | null
  createdAt: number | null
  fileSize: number
  snippet: string
  wordCount: number
  relationships: Record<string, string[]>
  icon: string | null
  color: string | null
  order: number | null
  sidebarLabel: string | null
  template: string | null
  sort: string | null
  view: string | null
  visible: boolean | null
  outgoingLinks: string[]
  properties: Record<string, string | number | boolean | null>
}

interface VaultFolderNode {
  name: string
  path: string
  children: VaultFolderNode[]
}

interface GitCommit {
  hash: string
  shortHash: string
  message: string
  author: string
  date: number
}

interface ModifiedFile {
  path: string
  relativePath: string
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed'
}

interface GitRemoteStatus {
  branch: string
  ahead: number
  behind: number
  hasRemote: boolean
  remoteUrl: string | null
  gitRoot: string
}

interface GitPullResult {
  status: 'up_to_date' | 'updated' | 'conflict' | 'no_remote' | 'error'
  message: string
  updatedFiles: string[]
  conflictFiles: string[]
}

interface GitPushResult {
  status: 'ok' | 'rejected' | 'auth_error' | 'network_error' | 'error'
  message: string
}

interface GitAddRemoteResult {
  status: 'connected' | 'already_configured' | 'incompatible_history' | 'auth_error' | 'network_error' | 'error'
  message: string
}

interface LastCommitInfo {
  shortHash: string
  commitUrl: string | null
}

interface PulseFile {
  path: string
  status: 'added' | 'modified' | 'deleted'
  title: string
}

interface PulseCommit {
  hash: string
  shortHash: string
  message: string
  date: number
  githubUrl: string | null
  files: PulseFile[]
  added: number
  modified: number
  deleted: number
}

/** Extract all [[wiki-links]] from a string. */
function extractWikiLinks(value: string): string[] {
  const matches = value.match(/\[\[[^\]]+\]\]/g)
  return matches ?? []
}

/** Extract wiki-links from a frontmatter value (string or array of strings). */
function wikiLinksFromValue(value: unknown): string[] {
  return collectWikiLinksFromValue(value, 0)
}

function collectWikiLinksFromValue(value: unknown, depth: number): string[] {
  if (typeof value === 'string') return extractWikiLinks(value)
  if (!Array.isArray(value)) return []

  const nestedLink = nestedFlowWikilink(value, depth)
  if (nestedLink) return [nestedLink]
  return value.flatMap((item) => collectWikiLinksFromValue(item, depth + 1))
}

function nestedFlowWikilink(value: unknown[], depth: number): string | null {
  if (depth === 0 || value.length !== 1 || typeof value[0] !== 'string') return null
  return extractWikiLinks(value[0]).length === 0 ? `[[${value[0]}]]` : null
}

// Frontmatter keys that map to dedicated VaultEntry fields (skip in generic properties/relationships)
const DEDICATED_KEYS = new Set([
  'aliases', 'is_a', 'is a', 'type', 'status', 'title', '_archived',
  'archived', '_icon', 'icon', 'color', '_order', 'order',
  '_sidebar_label', 'sidebar_label', 'sidebar label', 'template',
  '_sort', 'sort', 'view', '_width', 'width', 'visible',
  '_organized', '_favorite', '_favorite_index', '_list_properties_display',
].map((key) => key.toLowerCase()))

type FrontmatterPropertyValue = string | number | boolean | null
type VaultSearchResult = { title: string; path: string; snippet: string; score: number; note_type: string | null }

interface SearchEntryInput {
  entry: VaultEntry
  query: string
  rawContent: string
}

interface SearchRequestInput {
  query: string
  vaultPath: string
}

interface SearchResponseInput {
  mode: string
  query: string
  results: VaultSearchResult[]
}

function getFrontmatterValue(
  frontmatter: Record<string, unknown>,
  keys: string[],
): unknown {
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()))
  return Object.entries(frontmatter).find(([key]) => normalizedKeys.has(key.toLowerCase()))?.[1]
}

function parseYamlBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return null

  switch (value.toLowerCase()) {
    case 'true':
    case 'yes':
      return true
    case 'false':
    case 'no':
      return false
    default:
      return null
  }
}

const vitestCoverageDirectory = process.env.VITEST_COVERAGE_DIR
  ?? path.join(os.tmpdir(), 'tolaria-vitest-coverage', String(process.pid))

const devServerWatchIgnored = [
  '**/coverage/**',
  '**/test-results/**',
  '**/playwright-report/**',
  '**/dist/**',
  '**/src-tauri/target/**',
]

function envPort(names: string[], fallback: number): number {
  for (const name of names) {
    const raw = process.env[name]?.trim()
    if (!raw) continue
    const port = Number(raw)
    if (Number.isInteger(port) && port > 0 && port <= 65535) return port
  }
  return fallback
}

function envString(names: string[], fallback: string): string {
  for (const name of names) {
    const raw = process.env[name]?.trim()
    if (raw) return raw
  }
  return fallback
}

const webDevHost = envString(['ARTEMIS_HOST', 'HOST'], 'localhost')
const webDevPort = envPort(['ARTEMIS_PORT', 'ARTEMIS_WEB_PORT', 'VITE_ARTEMIS_WEB_PORT', 'PORT'], 5202)
const buildTarget = 'es2022'

function readUtf8File(filePath: string): string {
  const fd = openSync(filePath, 'r')
  try {
    return readFileSync(fd, 'utf-8')
  } finally {
    closeSync(fd)
  }
}

function writeUtf8File(filePath: string, content: string): void {
  const fd = openSync(filePath, 'w')
  try {
    writeFileSync(fd, content, 'utf-8')
  } finally {
    closeSync(fd)
  }
}

function pathStats(filePath: string) {
  const fd = openSync(filePath, 'r')
  try {
    return fstatSync(fd)
  } finally {
    closeSync(fd)
  }
}

function pathExists(filePath: string): boolean {
  try {
    pathStats(filePath)
    return true
  } catch {
    return false
  }
}

function pathIsDirectory(filePath: string): boolean {
  try {
    return pathStats(filePath).isDirectory()
  } catch {
    return false
  }
}

function resolveUserPath(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return trimmed

  if (trimmed === '~') return os.homedir()
  if (trimmed.startsWith(`~${path.sep}`) || trimmed.startsWith('~/')) {
    return path.resolve(os.homedir(), trimmed.slice(2))
  }
  if (path.isAbsolute(trimmed)) return path.resolve(trimmed)

  const cwdCandidate = path.resolve(process.cwd(), trimmed)
  if (pathExists(cwdCandidate)) return cwdCandidate
  return path.resolve(os.homedir(), trimmed)
}

function defaultWebVaultRoot(): string {
  const configuredRoot = process.env.ARTEMIS_WEB_VAULT_ROOT?.trim()
    || process.env.TOLARIA_WEB_VAULT_ROOT?.trim()
  if (configuredRoot) return resolveUserPath(configuredRoot)

  const rootGit = path.resolve('/root/git')
  return pathIsDirectory(rootGit) ? rootGit : path.join(os.homedir(), 'Artemis Vault')
}

function directoryEntries(dir: string): Dirent[] {
  const directory = opendirSync(dir)
  try {
    const entries: Dirent[] = []
    let entry = directory.readSync()
    while (entry) {
      entries.push(entry)
      entry = directory.readSync()
    }
    return entries
  } finally {
    directory.closeSync()
  }
}

function isInsideRelativePath(relative: string): boolean {
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function resolveInside(root: string, target: string): string | null {
  const normalizedTarget = path.normalize(target)
  if (path.isAbsolute(normalizedTarget)) return null
  const candidate = path.normalize(`${root}${path.sep}${normalizedTarget}`)
  return isInsideRelativePath(path.relative(root, candidate)) ? candidate : null
}

function frontmatterString(frontmatter: Record<string, unknown>, ...keys: string[]): string | null {
  const value = getFrontmatterValue(frontmatter, keys)
  return typeof value === 'string' ? value : null
}

function frontmatterStringArray(frontmatter: Record<string, unknown>, ...keys: string[]): string[] {
  const value = getFrontmatterValue(frontmatter, keys)
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return [value]
  return []
}

function frontmatterBool(frontmatter: Record<string, unknown>, ...keys: string[]): boolean | null {
  return parseYamlBool(getFrontmatterValue(frontmatter, keys))
}

function markdownTitle(content: string, frontmatter: Record<string, unknown>, fallback: string): string {
  const title = frontmatterString(frontmatter, 'title')
  if (title) return title

  const h1Match = content.match(/^#\s+(.+)$/m)
  return h1Match ? h1Match[1].trim() : fallback
}

function markdownBodyText(content: string): string {
  return content.replace(/^#+\s+.+$/gm, '').replace(/[\n\r]+/g, ' ').trim()
}

function frontmatterWikiLinks(frontmatter: Record<string, unknown>, ...keys: string[]): string[] {
  return frontmatterStringArray(frontmatter, ...keys).flatMap((value) => extractWikiLinks(value))
}

function frontmatterRelationships(frontmatter: Record<string, unknown>): Record<string, string[]> {
  const relationships: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(frontmatter)) {
    if (DEDICATED_KEYS.has(key.toLowerCase())) continue
    const links = wikiLinksFromValue(value)
    if (links.length > 0) relationships[key] = links
  }
  return relationships
}

function frontmatterProperties(frontmatter: Record<string, unknown>): Record<string, FrontmatterPropertyValue> {
  const properties: Record<string, FrontmatterPropertyValue> = {}
  for (const [key, value] of Object.entries(frontmatter)) {
    if (DEDICATED_KEYS.has(key.toLowerCase()) || key.trim().startsWith('_')) continue
    const propertyValue = frontmatterPropertyValue(value)
    if (propertyValue !== undefined) properties[key] = propertyValue
  }
  return properties
}

function isScalarFrontmatterProperty(value: unknown): value is number | boolean {
  return typeof value === 'number' || typeof value === 'boolean'
}

function singleStringArrayValue(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined
  if (value.length !== 1) return undefined
  return typeof value[0] === 'string' ? value[0] : undefined
}

function wikiLinkFreeString(value: string): string | undefined {
  return extractWikiLinks(value).length === 0 ? value : undefined
}

function frontmatterPropertyValue(value: unknown): FrontmatterPropertyValue | undefined {
  if (value === null) return null
  if (isScalarFrontmatterProperty(value)) return value
  if (typeof value === 'string') return wikiLinkFreeString(value)
  const singleArrayValue = singleStringArrayValue(value)
  return singleArrayValue === undefined ? undefined : wikiLinkFreeString(singleArrayValue)
}

function parseMarkdownFile(filePath: string): VaultEntry | null {
  try {
    const raw = readUtf8File(filePath)
    const stats = pathStats(filePath)
    const { data, content } = matter(raw)
    const fm = data as Record<string, unknown>

    const filename = path.basename(filePath)
    const basename = filename.replace(/\.md$/, '')

    const title = markdownTitle(content, fm, basename)
    const bodyText = markdownBodyText(content)
    const snippet = bodyText.slice(0, 200)

    return {
      path: filePath,
      filename,
      title,
      isA: frontmatterString(fm, 'is_a', 'is a', 'type'),
      aliases: frontmatterStringArray(fm, 'aliases'),
      belongsTo: frontmatterWikiLinks(fm, 'belongs_to', 'belongs to'),
      relatedTo: frontmatterWikiLinks(fm, 'related_to', 'related to'),
      status: frontmatterString(fm, 'status'),
      archived: frontmatterBool(fm, 'archived') ?? false,
      trashed: frontmatterBool(fm, 'trashed') ?? false,
      trashedAt: null,
      modifiedAt: stats.mtimeMs,
      createdAt: stats.birthtimeMs,
      fileSize: stats.size,
      snippet,
      wordCount: bodyText.split(/\s+/).filter(Boolean).length,
      relationships: frontmatterRelationships(fm),
      icon: frontmatterString(fm, 'icon'),
      color: frontmatterString(fm, 'color'),
      order: fm.order != null ? Number(fm.order) : null,
      sidebarLabel: frontmatterString(fm, 'sidebar label', 'sidebar_label'),
      template: frontmatterString(fm, 'template'),
      sort: frontmatterString(fm, 'sort'),
      view: frontmatterString(fm, 'view'),
      visible: frontmatterBool(fm, 'visible'),
      outgoingLinks: [],
      properties: frontmatterProperties(fm),
    }
  } catch {
    return null
  }
}

/** Recursively find all .md files under a directory. */
function findMarkdownFiles(dir: string): string[] {
  const results: string[] = []
  try {
    const items = directoryEntries(dir)
    for (const item of items) {
      if (item.name.startsWith('.')) continue
      const full = resolveInside(dir, item.name)
      if (!full) continue
      if (item.isDirectory()) {
        results.push(...findMarkdownFiles(full))
      } else if (item.name.endsWith('.md')) {
        results.push(full)
      }
    }
  } catch {
    // skip unreadable dirs
  }
  return results
}

function buildFolderTree(dir: string, vaultRoot: string): VaultFolderNode[] {
  const nodes: VaultFolderNode[] = []
  try {
    for (const item of directoryEntries(dir)) {
      if (!item.isDirectory() || item.name.startsWith('.') || item.name === 'node_modules') continue
      const full = resolveInside(dir, item.name)
      if (!full) continue
      const relativePath = path.relative(vaultRoot, full).replaceAll(path.sep, '/')
      nodes.push({
        name: item.name,
        path: relativePath,
        children: buildFolderTree(full, vaultRoot),
      })
    }
  } catch {
    return nodes
  }
  return nodes.sort((a, b) => a.name.localeCompare(b.name))
}

function sendJson(res: ServerResponse, payload: unknown, statusCode = 200): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

const ASSET_MIME_TYPES: Record<string, string> = {
  '.apng': 'image/apng',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.webp': 'image/webp',
}

function sendAsset(res: ServerResponse, filePath: string): void {
  const mime = ASSET_MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  res.statusCode = 200
  res.setHeader('Content-Type', mime)
  createReadStream(filePath).pipe(res)
}

function readExistingQueryPath(url: URL, res: ServerResponse, key: string): string | null {
  const rawPath = url.searchParams.get(key)
  const filePath = rawPath ? resolveUserPath(rawPath) : null
  if (!filePath || !pathExists(filePath)) {
    sendJson(res, { error: 'Invalid or missing path' }, 400)
    return null
  }
  return filePath
}

function updateTitleWikilinks(vaultPath: string, oldTitle: string, _newTitle: string, excludePath: string): number {
  const newPathStem = path.relative(vaultPath, excludePath).replace(/\.md$/i, '')
  const oldTargets = collectLegacyWikilinkTargets(oldTitle, excludePath, vaultPath)
  return updateWikilinksForTargets(vaultPath, oldTargets, newPathStem, excludePath)
}

function collectLegacyWikilinkTargets(oldTitle: string, oldPath: string, vaultPath: string): string[] {
  const oldRelativeStem = path.relative(vaultPath, oldPath).replace(/\.md$/i, '')
  const oldFilenameStem = path.basename(oldPath, '.md')
  return [...new Set([oldTitle, oldRelativeStem, oldFilenameStem].filter(Boolean))]
}

function updateWikilinksForTargets(vaultPath: string, oldTargets: string[], newTarget: string, excludePath: string): number {
  if (oldTargets.length === 0) return 0
  const allFiles = findMarkdownFiles(vaultPath)
  const targets = new Set(oldTargets)
  let updatedFiles = 0
  for (const filePath of allFiles) {
    if (filePath === excludePath) continue
    try {
      const content = readUtf8File(filePath)
      const replaced = content.replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, (match: string, target: string, pipe: string | undefined) => {
        if (!targets.has(target)) return match
        return pipe ? `[[${newTarget}${pipe}]]` : `[[${newTarget}]]`
      })
      if (replaced !== content) {
        writeUtf8File(filePath, replaced)
        updatedFiles++
      }
    } catch {
      // Skip unreadable files in the dev vault API.
    }
  }
  return updatedFiles
}

function replaceNoteTitleInContent(content: string, newTitle: string): string {
  const withFrontmatterTitle = /^title:\s*.*$/m.test(content)
    ? content.replace(/^title:\s*.*$/m, `title: ${newTitle}`)
    : content
  return /^# .+$/m.test(withFrontmatterTitle)
    ? withFrontmatterTitle.replace(/^# .+$/m, `# ${newTitle}`)
    : withFrontmatterTitle
}

function updatePathWikilinks(vaultPath: string, oldPath: string, newPath: string, oldTitle: string): number {
  const newRelativeStem = path.relative(vaultPath, newPath).replace(/\.md$/i, '')
  const oldTargets = collectLegacyWikilinkTargets(oldTitle, oldPath, vaultPath)
  return updateWikilinksForTargets(vaultPath, oldTargets, newRelativeStem, newPath)
}

function handleVaultPing(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/ping') return false
  sendJson(res, { ok: true })
  return true
}

function handleVaultDefaultPath(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/default-path') return false
  sendJson(res, defaultWebVaultRoot())
  return true
}

function handleVaultResolvePath(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/resolve-path') return false
  const rawPath = url.searchParams.get('path')
  sendJson(res, rawPath ? resolveUserPath(rawPath) : '')
  return true
}

function handleVaultList(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/list') return false
  const dirPath = readExistingQueryPath(url, res, 'path')
  if (!dirPath) return true
  const entries = findMarkdownFiles(dirPath).map(parseMarkdownFile).filter(Boolean)
  sendJson(res, entries)
  return true
}

function handleVaultFolders(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/folders') return false
  const dirPath = readExistingQueryPath(url, res, 'path')
  if (!dirPath) return true
  sendJson(res, buildFolderTree(dirPath, dirPath))
  return true
}

function handleVaultContent(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/content') return false
  const filePath = readExistingQueryPath(url, res, 'path')
  if (!filePath) return true
  sendJson(res, { content: readUtf8File(filePath) })
  return true
}

function findGitRoot(filePath: string): string | null {
  let dir = pathStats(filePath).isDirectory() ? filePath : path.dirname(filePath)
  while (true) {
    if (pathExists(path.join(dir, '.git'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function gitFileHistory(filePath: string): GitCommit[] {
  const gitRoot = findGitRoot(filePath)
  if (!gitRoot) return []
  const relativePath = path.relative(gitRoot, filePath).replaceAll(path.sep, '/')
  try {
    const output = gitCommand(gitRoot, ['log', '--follow', '--format=%H%x1f%h%x1f%an%x1f%ct%x1f%s', '--', relativePath])
    return output
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [hash = '', shortHash = '', author = '', date = '0', message = ''] = line.split('\x1f')
        return { hash, shortHash, author, date: Number(date) || 0, message }
      })
      .filter((commit) => commit.hash.length > 0)
  } catch {
    return []
  }
}

function candidateGitBinaries(): string[] {
  const configured = process.env.ARTEMIS_GIT_BINARY?.trim()
    || process.env.TOLARIA_GIT_BINARY?.trim()
    || process.env.GIT_BINARY?.trim()
  const candidates = [
    configured,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Git', 'cmd', 'git.exe') : undefined,
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'Git', 'cmd', 'git.exe') : undefined,
    'git',
  ]
  return candidates.filter((candidate): candidate is string => Boolean(candidate))
}

function resolveGitBinary(): string {
  for (const candidate of candidateGitBinaries()) {
    if (candidate === 'git' || pathExists(candidate)) return candidate
  }
  return 'git'
}

function gitCommand(gitRoot: string, args: string[]): string {
  return execFileSync(resolveGitBinary(), ['-C', gitRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function tryGitCommand(gitRoot: string, args: string[]): string | null {
  try {
    return gitCommand(gitRoot, args)
  } catch {
    return null
  }
}

function gitAuthorName(): string {
  return process.env.ARTEMIS_GIT_AUTHOR_NAME?.trim()
    || process.env.TOLARIA_GIT_AUTHOR_NAME?.trim()
    || process.env.GIT_AUTHOR_NAME?.trim()
    || process.env.USERNAME?.trim()
    || process.env.USER?.trim()
    || 'Artemis Web'
}

function gitAuthorEmail(): string {
  return process.env.ARTEMIS_GIT_AUTHOR_EMAIL?.trim()
    || process.env.TOLARIA_GIT_AUTHOR_EMAIL?.trim()
    || process.env.GIT_AUTHOR_EMAIL?.trim()
    || 'artemis@localhost'
}

function ensureGitCommitIdentity(gitRoot: string): void {
  if (!tryGitCommand(gitRoot, ['config', '--get', 'user.name'])?.trim()) {
    gitCommand(gitRoot, ['config', 'user.name', gitAuthorName()])
  }

  if (!tryGitCommand(gitRoot, ['config', '--get', 'user.email'])?.trim()) {
    gitCommand(gitRoot, ['config', 'user.email', gitAuthorEmail()])
  }
}

function prepareCloneDestination(localPath: string): string {
  const destination = resolveUserPath(localPath)
  if (!destination) throw new Error('Clone path is required')

  if (pathExists(destination)) {
    if (!pathIsDirectory(destination)) throw new Error('Clone path already exists and is not a folder')
    if (directoryEntries(destination).length > 0) throw new Error('Choose an empty folder for the cloned vault')
    return destination
  }

  mkdirSync(path.dirname(destination), { recursive: true })
  return destination
}

function cloneGitRepository(url: string | undefined, localPath: string | undefined): string {
  const trimmedUrl = url?.trim()
  const trimmedPath = localPath?.trim()
  if (!trimmedUrl || !trimmedPath) throw new Error('Repository URL and local path are required')

  const destination = prepareCloneDestination(trimmedPath)
  execFileSync(resolveGitBinary(), ['clone', '--quiet', trimmedUrl, destination], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return destination
}

function gitErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'stderr' in err) {
    const stderr = String((err as { stderr?: unknown }).stderr ?? '').trim()
    if (stderr) return stderr
  }
  return err instanceof Error && err.message.trim() ? err.message : fallback
}

function isCheckedOutBranchPushError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('refusing to update checked out branch') || lower.includes('branch is currently checked out')
}

function gitPushErrorResult(message: string): GitPushResult {
  if (isCheckedOutBranchPushError(message)) {
    return {
      status: 'error',
      message: 'Push failed: the local remote is a checked-out repository. Artemis tried to enable local-folder pushes, but the remote still refused the update. Use a bare repository or set receive.denyCurrentBranch=updateInstead in the remote.',
    }
  }

  return {
    status: /rejected|fetch first|non-fast-forward/i.test(message) ? 'rejected' : 'error',
    message,
  }
}

function gitRootForVaultPath(rawVaultPath: string | null | undefined): string | null {
  if (!rawVaultPath) return null
  const vaultPath = resolveUserPath(rawVaultPath)
  if (!pathExists(vaultPath)) return null
  return findGitRoot(vaultPath)
}

function absoluteGitPath(gitRoot: string, relativePath: string): string {
  return path.resolve(gitRoot, ...relativePath.split('/'))
}

function normalizeGitRelativePath(relativePath: string): string {
  return relativePath.replace(/^"|"$/g, '').replaceAll('\\', '/')
}

function statusFromPorcelain(code: string): ModifiedFile['status'] {
  if (code.includes('D')) return 'deleted'
  if (code.includes('R')) return 'renamed'
  if (code.includes('A') || code === '??') return code === '??' ? 'untracked' : 'added'
  return 'modified'
}

function parseGitStatusLine(gitRoot: string, line: string): ModifiedFile | null {
  if (line.length < 4) return null
  const code = line.slice(0, 2)
  const rawPath = line.slice(3)
  const relativePath = normalizeGitRelativePath(rawPath.includes(' -> ') ? rawPath.split(' -> ').pop() ?? rawPath : rawPath)
  if (!relativePath) return null
  return {
    path: absoluteGitPath(gitRoot, relativePath),
    relativePath,
    status: statusFromPorcelain(code),
  }
}

function gitModifiedFiles(gitRoot: string): ModifiedFile[] {
  const output = tryGitCommand(gitRoot, ['status', '--porcelain=v1', '--untracked-files=all'])
  if (!output) return []
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => parseGitStatusLine(gitRoot, line))
    .filter((file): file is ModifiedFile => file !== null)
}

function pulseStatusFromNameStatus(value: string): PulseFile['status'] {
  if (value.startsWith('A')) return 'added'
  if (value.startsWith('D')) return 'deleted'
  return 'modified'
}

function pulseTitleForFile(gitRoot: string, relativePath: string): string {
  const filePath = absoluteGitPath(gitRoot, relativePath)
  if (pathExists(filePath)) {
    const entry = parseMarkdownFile(filePath)
    if (entry) return entry.title
  }
  return path.basename(relativePath).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
}

function parsePulseFiles(gitRoot: string, commitHash: string): PulseFile[] {
  const output = tryGitCommand(gitRoot, ['show', '--format=', '--name-status', '--find-renames', commitHash])
  if (!output) return []
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      const parts = line.split(/\t+/)
      const statusCode = parts[0] ?? ''
      const relativePath = normalizeGitRelativePath(parts[2] ?? parts[1] ?? '')
      if (!relativePath) return []
      const status = pulseStatusFromNameStatus(statusCode)
      return [{ path: relativePath, status, title: pulseTitleForFile(gitRoot, relativePath) }]
    })
}

function summarizePulseFiles(files: PulseFile[]): Pick<PulseCommit, 'added' | 'modified' | 'deleted'> {
  return {
    added: files.filter((file) => file.status === 'added').length,
    modified: files.filter((file) => file.status === 'modified').length,
    deleted: files.filter((file) => file.status === 'deleted').length,
  }
}

function gitPulse(gitRoot: string, limit: number, skip: number): PulseCommit[] {
  const output = tryGitCommand(gitRoot, ['log', `--max-count=${limit}`, `--skip=${skip}`, '--format=%H%x1f%h%x1f%ct%x1f%s'])
  if (!output) return []
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [hash = '', shortHash = '', date = '0', message = ''] = line.split('\x1f')
      const files = parsePulseFiles(gitRoot, hash)
      return {
        hash,
        shortHash,
        message,
        date: Number(date) || 0,
        githubUrl: gitCommitUrl(gitRoot, hash),
        files,
        ...summarizePulseFiles(files),
      }
    })
    .filter((commit) => commit.hash.length > 0)
}

function gitCommitUrl(gitRoot: string, hash: string): string | null {
  const remote = tryGitCommand(gitRoot, ['remote', 'get-url', 'origin'])?.trim()
  if (!remote) return null
  const httpsMatch = remote.match(/^https:\/\/github\.com\/(.+?)(?:\.git)?$/)
  const sshMatch = remote.match(/^git@github\.com:(.+?)(?:\.git)?$/)
  const repo = httpsMatch?.[1] ?? sshMatch?.[1]
  return repo ? `https://github.com/${repo}/commit/${hash}` : null
}

function gitLastCommitInfo(gitRoot: string): LastCommitInfo | null {
  const output = tryGitCommand(gitRoot, ['log', '-1', '--format=%H%x1f%h'])?.trim()
  if (!output) return null
  const [hash = '', shortHash = ''] = output.split('\x1f')
  return shortHash ? { shortHash, commitUrl: gitCommitUrl(gitRoot, hash) } : null
}

function gitRemoteStatus(gitRoot: string): GitRemoteStatus {
  const branch = tryGitCommand(gitRoot, ['rev-parse', '--abbrev-ref', 'HEAD'])?.trim() || 'main'
  const remoteUrl = tryGitCommand(gitRoot, ['remote', 'get-url', 'origin'])?.trim() || null
  const hasRemote = Boolean(remoteUrl)
  const aheadBehind = hasRemote ? tryGitCommand(gitRoot, ['rev-list', '--left-right', '--count', 'HEAD...@{u}']) : null
  const [ahead = '0', behind = '0'] = (aheadBehind?.trim() ?? '').split(/\s+/)
  return {
    branch,
    ahead: Number(ahead) || 0,
    behind: Number(behind) || 0,
    hasRemote,
    remoteUrl,
    gitRoot,
  }
}

function gitCurrentBranch(gitRoot: string): string {
  return tryGitCommand(gitRoot, ['rev-parse', '--abbrev-ref', 'HEAD'])?.trim()
    || tryGitCommand(gitRoot, ['branch', '--show-current'])?.trim()
    || 'master'
}

function gitHasUpstream(gitRoot: string): boolean {
  return Boolean(tryGitCommand(gitRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])?.trim())
}

function gitEnsureUpstream(gitRoot: string): boolean {
  if (gitHasUpstream(gitRoot)) return true

  const branch = gitCurrentBranch(gitRoot)
  if (!branch || branch === 'HEAD') return false

  tryGitCommand(gitRoot, ['fetch', 'origin', branch])
  const remoteRef = tryGitCommand(gitRoot, ['rev-parse', '--verify', `origin/${branch}`])?.trim()
  if (!remoteRef) return false

  tryGitCommand(gitRoot, ['branch', '--set-upstream-to', `origin/${branch}`, branch])
  return true
}

function localRemotePath(gitRoot: string, remoteUrl: string | null | undefined): string | null {
  const trimmed = remoteUrl?.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('file://')) return path.resolve(trimmed.slice('file://'.length))
  if (trimmed.includes('://') || (trimmed.includes('@') && trimmed.includes(':'))) return null
  return path.isAbsolute(trimmed) ? path.resolve(trimmed) : path.resolve(gitRoot, trimmed)
}

function configureLocalRemoteForCheckedOutPush(gitRoot: string): boolean {
  const remotePath = localRemotePath(gitRoot, tryGitCommand(gitRoot, ['remote', 'get-url', 'origin']))
  if (!remotePath || !pathExists(remotePath)) return false

  try {
    gitCommand(remotePath, ['config', 'receive.denyCurrentBranch', 'updateInstead'])
    return true
  } catch {
    return false
  }
}

function runGitPush(gitRoot: string): string {
  if (gitHasUpstream(gitRoot)) return gitCommand(gitRoot, ['push'])

  const branch = gitCurrentBranch(gitRoot)
  return gitCommand(gitRoot, ['push', '--set-upstream', 'origin', branch])
}

function gitPush(gitRoot: string): string {
  try {
    return runGitPush(gitRoot)
  } catch (err: unknown) {
    if (isCheckedOutBranchPushError(gitErrorMessage(err, 'Push failed')) && configureLocalRemoteForCheckedOutPush(gitRoot)) {
      return runGitPush(gitRoot)
    }
    throw err
  }
}

function gitPull(gitRoot: string): string {
  if (!gitEnsureUpstream(gitRoot)) {
    return 'No upstream branch exists yet. Push first to publish this branch, then pull will track it.'
  }
  return gitCommand(gitRoot, ['pull', '--no-rebase'])
}

function gitConflictFiles(gitRoot: string): string[] {
  const output = tryGitCommand(gitRoot, ['diff', '--name-only', '--diff-filter=U'])
  return output ? output.split(/\r?\n/).filter(Boolean) : []
}

function handleVaultHistory(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/history') return false
  const filePath = readExistingQueryPath(url, res, 'path')
  if (!filePath) return true
  sendJson(res, gitFileHistory(filePath))
  return true
}

function handleVaultChanges(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/changes') return false
  const gitRoot = gitRootForVaultPath(url.searchParams.get('vaultPath'))
  sendJson(res, gitRoot ? gitModifiedFiles(gitRoot) : [])
  return true
}

function handleVaultDiff(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/diff') return false
  const filePath = readExistingQueryPath(url, res, 'path')
  if (!filePath) return true
  const gitRoot = findGitRoot(filePath)
  if (!gitRoot) {
    sendJson(res, '')
    return true
  }
  const relativePath = path.relative(gitRoot, filePath).replaceAll(path.sep, '/')
  sendJson(res, tryGitCommand(gitRoot, ['diff', '--', relativePath]) ?? '')
  return true
}

function handleVaultDiffAtCommit(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/diff-at-commit') return false
  const filePath = readExistingQueryPath(url, res, 'path')
  if (!filePath) return true
  const commitHash = url.searchParams.get('commitHash') ?? ''
  const gitRoot = findGitRoot(filePath)
  if (!gitRoot || !commitHash) {
    sendJson(res, '')
    return true
  }
  const relativePath = path.relative(gitRoot, filePath).replaceAll(path.sep, '/')
  sendJson(res, tryGitCommand(gitRoot, ['show', '--format=', '--patch', commitHash, '--', relativePath]) ?? '')
  return true
}

function handleVaultIsGitRepo(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/git/is-repo') return false
  sendJson(res, Boolean(gitRootForVaultPath(url.searchParams.get('vaultPath'))))
  return true
}

async function handleVaultInitGit(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!isPostRoute(url, req, '/api/vault/git/init')) return false
  const { vaultPath: rawVaultPath } = await readJsonBody<{ vaultPath?: string }>(req)
  const vaultPath = rawVaultPath ? resolveUserPath(rawVaultPath) : ''
  if (!vaultPath || !pathIsDirectory(vaultPath)) {
    sendJson(res, { error: 'Invalid vault path' }, 400)
    return true
  }
  gitCommand(vaultPath, ['init'])
  sendJson(res, null)
  return true
}

async function handleVaultGitClone(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!isPostRoute(url, req, '/api/vault/git/clone')) return false
  try {
    const { url: repoUrl, localPath } = await readJsonBody<{ url?: string; localPath?: string }>(req)
    sendJson(res, cloneGitRepository(repoUrl, localPath))
  } catch (err: unknown) {
    sendJson(res, { error: gitErrorMessage(err, 'Clone failed') }, 500)
  }
  return true
}

function handleVaultGitRemoteStatus(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/git/remote-status') return false
  const gitRoot = gitRootForVaultPath(url.searchParams.get('vaultPath'))
  sendJson(res, gitRoot ? gitRemoteStatus(gitRoot) : { branch: '', ahead: 0, behind: 0, hasRemote: false, remoteUrl: null, gitRoot: null })
  return true
}

async function handleVaultGitAddRemote(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!isPostRoute(url, req, '/api/vault/git/add-remote')) return false
  try {
    const { vaultPath: rawVaultPath, remoteUrl } = await readJsonBody<{ vaultPath?: string; remoteUrl?: string }>(req)
    const gitRoot = gitRootForVaultPath(rawVaultPath)
    const trimmedRemoteUrl = remoteUrl?.trim()
    if (!gitRoot) {
      sendJson(res, { status: 'error', message: 'Not a git repository' } satisfies GitAddRemoteResult)
      return true
    }
    if (!trimmedRemoteUrl) {
      sendJson(res, { status: 'error', message: 'Remote URL is required' } satisfies GitAddRemoteResult)
      return true
    }
    const existingRemote = tryGitCommand(gitRoot, ['remote', 'get-url', 'origin'])?.trim()
    if (existingRemote) {
      if (existingRemote === trimmedRemoteUrl) {
        sendJson(res, { status: 'already_configured', message: 'Remote is already configured' } satisfies GitAddRemoteResult)
        return true
      }
      gitCommand(gitRoot, ['remote', 'set-url', 'origin', trimmedRemoteUrl])
      sendJson(res, { status: 'connected', message: 'Remote updated' } satisfies GitAddRemoteResult)
      return true
    }
    gitCommand(gitRoot, ['remote', 'add', 'origin', trimmedRemoteUrl])
    sendJson(res, { status: 'connected', message: 'Remote connected' } satisfies GitAddRemoteResult)
  } catch (err: unknown) {
    sendJson(res, { status: 'error', message: gitErrorMessage(err, 'Could not connect remote') } satisfies GitAddRemoteResult)
  }
  return true
}

async function handleVaultGitCommit(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!isPostRoute(url, req, '/api/vault/git/commit')) return false
  try {
    const { vaultPath: rawVaultPath, message } = await readJsonBody<{ vaultPath?: string; message?: string }>(req)
    const gitRoot = gitRootForVaultPath(rawVaultPath)
    const commitMessage = message?.trim()
    if (!gitRoot || !commitMessage) {
      sendJson(res, { error: 'Missing git repository or commit message' }, 400)
      return true
    }
    gitCommand(gitRoot, ['add', '-A'])
    if (!gitModifiedFiles(gitRoot).length) {
      sendJson(res, { error: 'Nothing to commit' }, 400)
      return true
    }
    ensureGitCommitIdentity(gitRoot)
    sendJson(res, gitCommand(gitRoot, ['commit', '-m', commitMessage]))
  } catch (err: unknown) {
    sendJson(res, { error: gitErrorMessage(err, 'Commit failed') }, 500)
  }
  return true
}

async function handleVaultGitPush(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!isPostRoute(url, req, '/api/vault/git/push')) return false
  try {
    const { vaultPath: rawVaultPath } = await readJsonBody<{ vaultPath?: string }>(req)
    const gitRoot = gitRootForVaultPath(rawVaultPath)
    if (!gitRoot) {
      sendJson(res, { status: 'error', message: 'Not a git repository' } satisfies GitPushResult)
      return true
    }
    const output = gitPush(gitRoot).trim()
    sendJson(res, { status: 'ok', message: output || 'Push complete' } satisfies GitPushResult)
  } catch (err: unknown) {
    const message = gitErrorMessage(err, 'Push failed')
    sendJson(res, gitPushErrorResult(message))
  }
  return true
}

async function handleVaultGitPull(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!isPostRoute(url, req, '/api/vault/git/pull')) return false
  let gitRoot: string | null = null
  try {
    const { vaultPath: rawVaultPath } = await readJsonBody<{ vaultPath?: string }>(req)
    gitRoot = gitRootForVaultPath(rawVaultPath)
    if (!gitRoot) {
      sendJson(res, { status: 'no_remote', message: 'Not a git repository', updatedFiles: [], conflictFiles: [] } satisfies GitPullResult)
      return true
    }
    if (!gitRemoteStatus(gitRoot).hasRemote) {
      sendJson(res, { status: 'no_remote', message: 'No remote configured', updatedFiles: [], conflictFiles: [] } satisfies GitPullResult)
      return true
    }
    const before = tryGitCommand(gitRoot, ['rev-parse', 'HEAD'])?.trim() ?? ''
    const output = gitPull(gitRoot).trim()
    const after = tryGitCommand(gitRoot, ['rev-parse', 'HEAD'])?.trim() ?? ''
    const updatedFiles = before && after && before !== after
      ? (tryGitCommand(gitRoot, ['diff', '--name-only', before, after]) ?? '').split(/\r?\n/).filter(Boolean)
      : []
    sendJson(res, {
      status: updatedFiles.length > 0 ? 'updated' : 'up_to_date',
      message: output || 'Pull complete',
      updatedFiles,
      conflictFiles: [],
    } satisfies GitPullResult)
  } catch (err: unknown) {
    const message = gitErrorMessage(err, 'Pull failed')
    const conflictFiles = gitRoot ? gitConflictFiles(gitRoot) : []
    sendJson(res, {
      status: conflictFiles.length > 0 ? 'conflict' : 'error',
      message: conflictFiles.length > 0 ? `Merge conflict in ${conflictFiles.length} file(s)` : message,
      updatedFiles: [],
      conflictFiles,
    } satisfies GitPullResult)
  }
  return true
}

async function handleVaultGitDiscard(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!isPostRoute(url, req, '/api/vault/git/discard')) return false
  try {
    const { vaultPath: rawVaultPath, relativePath } = await readJsonBody<{ vaultPath?: string; relativePath?: string }>(req)
    const gitRoot = gitRootForVaultPath(rawVaultPath)
    const normalizedRelativePath = normalizeGitRelativePath(relativePath ?? '')
    if (!gitRoot || !normalizedRelativePath) {
      sendJson(res, { error: 'Missing git repository or file path' }, 400)
      return true
    }
    const targetPath = absoluteGitPath(gitRoot, normalizedRelativePath)
    if (!isInsideRelativePath(path.relative(gitRoot, targetPath))) {
      sendJson(res, { error: 'Invalid git file path' }, 400)
      return true
    }
    const status = gitModifiedFiles(gitRoot).find(file => file.relativePath === normalizedRelativePath)?.status
    if (status === 'untracked') {
      rmSync(targetPath, { force: true })
    } else {
      gitCommand(gitRoot, ['checkout', '--', normalizedRelativePath])
    }
    sendJson(res, null)
  } catch (err: unknown) {
    sendJson(res, { error: gitErrorMessage(err, 'Discard failed') }, 500)
  }
  return true
}

function handleVaultLastCommit(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/git/last-commit') return false
  const gitRoot = gitRootForVaultPath(url.searchParams.get('vaultPath'))
  sendJson(res, gitRoot ? gitLastCommitInfo(gitRoot) : null)
  return true
}

function handleVaultPulse(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/pulse') return false
  const gitRoot = gitRootForVaultPath(url.searchParams.get('vaultPath'))
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20) || 20, 1), 100)
  const skip = Math.max(Number(url.searchParams.get('skip') ?? 0) || 0, 0)
  sendJson(res, gitRoot ? gitPulse(gitRoot, limit, skip) : [])
  return true
}

function handleVaultConflictFiles(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/git/conflicts') return false
  const gitRoot = gitRootForVaultPath(url.searchParams.get('vaultPath'))
  sendJson(res, gitRoot ? gitConflictFiles(gitRoot) : [])
  return true
}

function handleVaultAsset(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/asset') return false
  const filePath = readExistingQueryPath(url, res, 'path')
  if (!filePath) return true
  if (!pathStats(filePath).isFile()) {
    sendJson(res, { error: 'Invalid asset path' }, 400)
    return true
  }
  sendAsset(res, filePath)
  return true
}

function handleVaultAllContent(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/all-content') return false
  const dirPath = readExistingQueryPath(url, res, 'path')
  if (!dirPath) return true
  const contentMap: Record<string, string> = {}
  for (const filePath of findMarkdownFiles(dirPath)) {
    try {
      contentMap[filePath] = readUtf8File(filePath)
    } catch {
      // Skip unreadable files.
    }
  }
  sendJson(res, contentMap)
  return true
}

function handleVaultExists(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/exists') return false
  const rawPath = url.searchParams.get('path')
  const dirPath = rawPath ? resolveUserPath(rawPath) : null
  sendJson(res, Boolean(dirPath && pathIsDirectory(dirPath)))
  return true
}

function handleVaultEntry(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/entry') return false
  const filePath = readExistingQueryPath(url, res, 'path')
  if (!filePath) return true
  sendJson(res, parseMarkdownFile(filePath))
  return true
}

function handleVaultSearch(url: URL, res: ServerResponse): boolean {
  if (url.pathname !== '/api/vault/search') return false
  const vaultPath = url.searchParams.get('vault_path')
  const query = (url.searchParams.get('query') ?? '').toLowerCase()
  const mode = url.searchParams.get('mode') ?? 'all'
  if (!vaultPath || !query) {
    sendVaultSearchResponse(res, { results: [], query, mode })
    return true
  }

  sendVaultSearchResponse(res, {
    results: collectVaultSearchResults({ vaultPath, query }),
    query,
    mode,
  })
  return true
}

function collectVaultSearchResults({ vaultPath, query }: SearchRequestInput): VaultSearchResult[] {
  const results: VaultSearchResult[] = []
  for (const filePath of findMarkdownFiles(vaultPath)) {
    const entry = parseMarkdownFile(filePath)
    if (!entry || entry.trashed) continue
    const rawContent = readUtf8File(filePath)
    if (entryMatchesSearch({ entry, rawContent, query })) results.push(searchResultFromEntry(entry))
  }
  return results.slice(0, 20)
}

function entryMatchesSearch({ entry, rawContent, query }: SearchEntryInput): boolean {
  return entry.title.toLowerCase().includes(query) || rawContent.toLowerCase().includes(query)
}

function searchResultFromEntry(entry: VaultEntry): VaultSearchResult {
  return { title: entry.title, path: entry.path, snippet: entry.snippet, score: 1.0, note_type: entry.isA }
}

function sendVaultSearchResponse(res: ServerResponse, { results, query, mode }: SearchResponseInput): void {
  sendJson(res, { results, elapsed_ms: results.length > 0 ? 1 : 0, query, mode })
}

async function handleVaultSave(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!isPostRoute(url, req, '/api/vault/save')) return false
  try {
    await saveVaultContent(req, res)
  } catch (err: unknown) {
    sendCaughtError(res, err, 'Save failed')
  }
  return true
}

async function saveVaultContent(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { path: filePath, content } = await readJsonBody<{ path?: string; content?: string }>(req)
  if (!filePath || content === undefined) {
    sendJson(res, { error: 'Missing path or content' }, 400)
    return
  }

  const resolvedPath = resolveUserPath(filePath)
  mkdirSync(path.dirname(resolvedPath), { recursive: true })
  writeUtf8File(resolvedPath, content)
  sendJson(res, null)
}

async function handleVaultCreateEmpty(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!isPostRoute(url, req, '/api/vault/create-empty')) return false
  try {
    const { targetPath } = await readJsonBody<{ targetPath?: string }>(req)
    if (!targetPath) {
      sendJson(res, { error: 'Missing targetPath' }, 400)
      return true
    }
    const resolvedTargetPath = resolveUserPath(targetPath)
    mkdirSync(resolvedTargetPath, { recursive: true })
    sendJson(res, resolvedTargetPath)
  } catch (err: unknown) {
    sendCaughtError(res, err, 'Create vault failed')
  }
  return true
}

async function handleVaultCreateGettingStarted(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!isPostRoute(url, req, '/api/vault/create-getting-started')) return false
  try {
    const { targetPath } = await readJsonBody<{ targetPath?: string }>(req)
    if (!targetPath) {
      sendJson(res, { error: 'Missing targetPath' }, 400)
      return true
    }
    const resolvedTargetPath = resolveUserPath(targetPath)
    mkdirSync(path.dirname(resolvedTargetPath), { recursive: true })
    if (!pathExists(resolvedTargetPath)) {
      cpSync(path.resolve(__dirname, 'demo-vault-v2'), resolvedTargetPath, { recursive: true })
    }
    sendJson(res, resolvedTargetPath)
  } catch (err: unknown) {
    sendCaughtError(res, err, 'Create Getting Started vault failed')
  }
  return true
}

async function handleVaultCreateFolder(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!isPostRoute(url, req, '/api/vault/create-folder')) return false
  try {
    const { vaultPath, folderName } = await readJsonBody<{ vaultPath?: string; folderName?: string }>(req)
    const resolvedVaultPath = vaultPath ? resolveUserPath(vaultPath) : null
    const target = resolvedVaultPath && folderName ? resolveInside(resolvedVaultPath, folderName) : null
    if (!target) {
      sendJson(res, { error: 'Invalid folder path' }, 400)
      return true
    }
    mkdirSync(target, { recursive: true })
    sendJson(res, folderName)
  } catch (err: unknown) {
    sendCaughtError(res, err, 'Create folder failed')
  }
  return true
}

async function handleVaultRenameFolder(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!isPostRoute(url, req, '/api/vault/rename-folder')) return false
  try {
    const { vaultPath, folderPath, newName } = await readJsonBody<{
      vaultPath?: string
      folderPath?: string
      newName?: string
    }>(req)
    const resolvedVaultPath = vaultPath ? resolveUserPath(vaultPath) : null
    const oldPath = resolvedVaultPath && folderPath ? resolveInside(resolvedVaultPath, folderPath) : null
    const newRelativePath = folderPath && newName
      ? path.posix.join(path.posix.dirname(folderPath.replaceAll('\\', '/')), newName)
      : null
    const newPath = resolvedVaultPath && newRelativePath ? resolveInside(resolvedVaultPath, newRelativePath) : null
    if (!oldPath || !newPath || !newName || newName.includes('/') || newName.includes('\\')) {
      sendJson(res, { error: 'Invalid folder rename' }, 400)
      return true
    }
    renameSync(oldPath, newPath)
    sendJson(res, { old_path: folderPath, new_path: newRelativePath })
  } catch (err: unknown) {
    sendCaughtError(res, err, 'Rename folder failed')
  }
  return true
}

async function handleVaultDeleteFolder(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!isPostRoute(url, req, '/api/vault/delete-folder')) return false
  try {
    const { vaultPath, folderPath } = await readJsonBody<{ vaultPath?: string; folderPath?: string }>(req)
    const resolvedVaultPath = vaultPath ? resolveUserPath(vaultPath) : null
    const target = resolvedVaultPath && folderPath ? resolveInside(resolvedVaultPath, folderPath) : null
    if (!target) {
      sendJson(res, { error: 'Invalid folder path' }, 400)
      return true
    }
    rmSync(target, { recursive: true, force: true })
    sendJson(res, folderPath)
  } catch (err: unknown) {
    sendCaughtError(res, err, 'Delete folder failed')
  }
  return true
}

async function handleVaultRename(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!isPostRoute(url, req, '/api/vault/rename')) return false
  try {
    await renameVaultNoteTitle(req, res)
  } catch (err: unknown) {
    sendCaughtError(res, err, 'Rename failed')
  }
  return true
}

async function renameVaultNoteTitle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const {
    vault_path: vaultPath,
    old_path: rawOldPath,
    new_title: newTitle,
  } = await readJsonBody<{ vault_path?: string; old_path: string; new_title: string }>(req)
  const oldPath = resolveUserPath(rawOldPath)
  const resolvedVaultPath = vaultPath ? resolveUserPath(vaultPath) : undefined
  const oldContent = readUtf8File(oldPath)
  const oldTitle = parseMarkdownFile(oldPath)?.title ?? path.basename(oldPath, '.md')
  const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const newPath = markdownSiblingPath(oldPath, slug)
  if (!newPath) {
    sendJson(res, { error: 'Invalid title' }, 400)
    return
  }
  if (newPath !== oldPath && pathExists(newPath)) {
    sendJson(res, { error: 'A note with that name already exists' }, 409)
    return
  }

  writeUtf8File(newPath, replaceNoteTitleInContent(oldContent, newTitle))
  if (newPath !== oldPath) unlinkSync(oldPath)

  const updatedFiles = resolvedVaultPath ? updateTitleWikilinks(resolvedVaultPath, oldTitle, newTitle, newPath) : 0
  sendJson(res, { new_path: newPath, updated_files: updatedFiles })
}

type FilenameStemValidation =
  | { ok: true; stem: string }
  | { ok: false; error: string }

function validateMarkdownFilenameStem(value: unknown): FilenameStemValidation {
  const stem = String(value ?? '').trim().replace(/\.md$/i, '').trim()
  if (!stem) return { ok: false, error: 'New filename cannot be empty' }
  if (isUnsafeMarkdownFilenameStem(stem)) return { ok: false, error: 'Invalid filename' }
  return { ok: true, stem }
}

function isUnsafeMarkdownFilenameStem(stem: string): boolean {
  return stem === '.' || stem === '..' || stem.includes('/') || stem.includes('\\')
}

function markdownSiblingPath(filePath: string, stem: string): string | null {
  if (isUnsafeMarkdownFilenameStem(stem)) return null
  return resolveInside(path.dirname(filePath), `${stem}.md`)
}

async function handleVaultRenameFilename(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!isPostRoute(url, req, '/api/vault/rename-filename')) return false
  try {
    await renameVaultNoteFilename(req, res)
  } catch (err: unknown) {
    sendCaughtError(res, err, 'Rename failed')
  }
  return true
}

async function renameVaultNoteFilename(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const {
    vault_path: vaultPath,
    old_path: rawOldPath,
    new_filename_stem: newFilenameStem,
  } = await readJsonBody<{ vault_path?: string; old_path: string; new_filename_stem: string }>(req)
  const oldPath = resolveUserPath(rawOldPath)
  const resolvedVaultPath = vaultPath ? resolveUserPath(vaultPath) : undefined
  const filename = validateMarkdownFilenameStem(newFilenameStem)
  if (!filename.ok) {
    sendJson(res, { error: filename.error }, 400)
    return
  }

  const newPath = markdownSiblingPath(oldPath, filename.stem)
  if (!newPath) {
    sendJson(res, { error: 'Invalid filename' }, 400)
    return
  }
  if (newPath !== oldPath && pathExists(newPath)) {
    sendJson(res, { error: 'A note with that name already exists' }, 409)
    return
  }

  const oldTitle = parseMarkdownFile(oldPath)?.title ?? path.basename(oldPath, '.md')
  renameSync(oldPath, newPath)
  const updatedFiles = resolvedVaultPath ? updatePathWikilinks(resolvedVaultPath, oldPath, newPath, oldTitle) : 0
  sendJson(res, { new_path: newPath, updated_files: updatedFiles })
}

async function handleVaultMoveToFolder(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!isPostRoute(url, req, '/api/vault/move-to-folder')) return false
  try {
    const {
      vault_path: rawVaultPath,
      old_path: rawOldPath,
      folder_path: folderPath,
    } = await readJsonBody<{ vault_path?: string; old_path?: string; folder_path?: string }>(req)
    if (!rawVaultPath || !rawOldPath || !folderPath) {
      sendJson(res, { error: 'Missing vault_path, old_path, or folder_path' }, 400)
      return true
    }
    const vaultPath = resolveUserPath(rawVaultPath)
    const oldPath = resolveUserPath(rawOldPath)
    const targetDir = resolveInside(vaultPath, folderPath)
    if (!targetDir) {
      sendJson(res, { error: 'Invalid folder path' }, 400)
      return true
    }
    mkdirSync(targetDir, { recursive: true })
    const newPath = resolveInside(targetDir, path.basename(oldPath))
    if (!newPath) {
      sendJson(res, { error: 'Invalid target path' }, 400)
      return true
    }
    if (newPath !== oldPath && pathExists(newPath)) {
      sendJson(res, { error: 'A note with that name already exists' }, 409)
      return true
    }
    const oldTitle = parseMarkdownFile(oldPath)?.title ?? path.basename(oldPath, '.md')
    renameSync(oldPath, newPath)
    const updatedFiles = updatePathWikilinks(vaultPath, oldPath, newPath, oldTitle)
    sendJson(res, { new_path: newPath, updated_files: updatedFiles, failed_updates: 0 })
  } catch (err: unknown) {
    sendCaughtError(res, err, 'Move note failed')
  }
  return true
}

async function handleVaultDelete(url: URL, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (url.pathname !== '/api/vault/delete' || req.method !== 'POST') return false
  try {
    const { path: rawFilePath, paths: rawPaths } = await readJsonBody<{ path?: string; paths?: string[] }>(req)
    const requestedPaths = Array.isArray(rawPaths) ? rawPaths : rawFilePath ? [rawFilePath] : []
    if (requestedPaths.length === 0) {
      sendJson(res, { error: 'Missing path' }, 400)
      return true
    }

    const deletedPaths: string[] = []
    for (const rawPath of requestedPaths) {
      const filePath = resolveUserPath(rawPath)
      if (!pathExists(filePath) || !pathStats(filePath).isFile()) continue
      unlinkSync(filePath)
      deletedPaths.push(filePath)
    }

    sendJson(res, Array.isArray(rawPaths) ? deletedPaths : deletedPaths[0] ?? null)
  } catch (err: unknown) {
    sendJson(res, { error: err instanceof Error ? err.message : 'Delete failed' }, 500)
  }
  return true
}

async function handleVaultApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  const handlers = [
    () => Promise.resolve(handleVaultPing(url, res)),
    () => Promise.resolve(handleVaultDefaultPath(url, res)),
    () => Promise.resolve(handleVaultResolvePath(url, res)),
    () => Promise.resolve(handleVaultList(url, res)),
    () => Promise.resolve(handleVaultFolders(url, res)),
    () => Promise.resolve(handleVaultAsset(url, res)),
    () => Promise.resolve(handleVaultContent(url, res)),
    () => Promise.resolve(handleVaultHistory(url, res)),
    () => Promise.resolve(handleVaultChanges(url, res)),
    () => Promise.resolve(handleVaultDiff(url, res)),
    () => Promise.resolve(handleVaultDiffAtCommit(url, res)),
    () => Promise.resolve(handleVaultAllContent(url, res)),
    () => Promise.resolve(handleVaultExists(url, res)),
    () => Promise.resolve(handleVaultEntry(url, res)),
    () => Promise.resolve(handleVaultSearch(url, res)),
    () => Promise.resolve(handleVaultIsGitRepo(url, res)),
    () => Promise.resolve(handleVaultGitRemoteStatus(url, res)),
    () => Promise.resolve(handleVaultLastCommit(url, res)),
    () => Promise.resolve(handleVaultPulse(url, res)),
    () => Promise.resolve(handleVaultConflictFiles(url, res)),
    () => handleVaultSave(url, req, res),
    () => handleVaultInitGit(url, req, res),
    () => handleVaultGitClone(url, req, res),
    () => handleVaultGitAddRemote(url, req, res),
    () => handleVaultGitCommit(url, req, res),
    () => handleVaultGitPush(url, req, res),
    () => handleVaultGitPull(url, req, res),
    () => handleVaultGitDiscard(url, req, res),
    () => handleVaultCreateEmpty(url, req, res),
    () => handleVaultCreateGettingStarted(url, req, res),
    () => handleVaultCreateFolder(url, req, res),
    () => handleVaultRenameFolder(url, req, res),
    () => handleVaultDeleteFolder(url, req, res),
    () => handleVaultRename(url, req, res),
    () => handleVaultRenameFilename(url, req, res),
    () => handleVaultMoveToFolder(url, req, res),
    () => handleVaultDelete(url, req, res),
  ]

  for (const handler of handlers) {
    if (await handler()) return true
  }

  return false
}

function vaultApiPlugin(): Plugin {
  return {
    name: 'vault-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (await handleVaultApiRequest(req, res)) return
        next()
      })
    },
  }
}

// --- Proxy helpers ---

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
  })
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  return JSON.parse(await readRequestBody(req)) as T
}

function isPostRoute(url: URL, req: IncomingMessage, pathname: string): boolean {
  return url.pathname === pathname && req.method === 'POST'
}

function sendCaughtError(res: ServerResponse, err: unknown, fallback: string): void {
  sendJson(res, { error: err instanceof Error ? err.message : fallback }, 500)
}


// https://vite.dev/config/
export default defineConfig({

  plugins: [react(), tailwindcss(), vaultApiPlugin()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Inject the demo-vault-v2 path in local dev only - production Tauri builds and
  // CI must resolve the default vault path at runtime via the backend to avoid
  // baking the CI runner's absolute path into the distributed bundle.
  define: {
    ...(process.env.CI || (process.env.TAURI_PLATFORM && !process.env.TAURI_DEBUG)
      ? {}
      : { __DEMO_VAULT_PATH__: JSON.stringify(path.resolve(__dirname, 'demo-vault-v2')) }),
  },

  // Prevent vite from obscuring Rust errors
  clearScreen: false,

  // Tauri expects port 5202 by default. Standalone web can override host/port
  // with ARTEMIS_HOST and ARTEMIS_PORT, e.g. ARTEMIS_HOST=0.0.0.0 ARTEMIS_PORT=5200.
  server: {
    host: webDevHost,
    port: webDevPort,
    strictPort: true,
    allowedHosts: true,
    watch: {
      ignored: devServerWatchIgnored,
    },
  },

  // Env variables starting with VITE_, TAURI_, or ARTEMIS_ are exposed to the frontend.
  // ARTEMIS_PASSWORD intentionally gates a simple client-side standalone web login.
  envPrefix: ['VITE_', 'TAURI_', 'ARTEMIS_'],

  build: {
    // Standalone web builds use modern browser output.
    target: buildTarget,
    // Don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      // Keep coverage temp files off the mounted workspace to avoid flaky
      // read-after-write races when Vitest re-reads its own coverage shards.
      reportsDirectory: vitestCoverageDirectory,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/mock-tauri.ts',
        'src/main.tsx',
        'src/types.ts',
        'src/hooks/useAiAgent.ts',
        'src/utils/ai-chat.ts',
        'src/utils/ai-agent.ts',
        'src/components/ui/dropdown-menu.tsx',
        'src/components/ui/scroll-area.tsx',
        'src/components/ui/select.tsx',
        'src/components/ui/separator.tsx',
        'src/components/ui/tabs.tsx',
        'src/components/ui/tooltip.tsx',
        'src/components/ui/card.tsx',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
})
