#!/usr/bin/env node
/**
 * Production static server for Artemis Web.
 * Serves dist/ + handles /api/vault/* routes for browser testing.
 */

import http from 'http'
import { execFileSync } from 'child_process'
import {
  closeSync,
  createReadStream,
  fstatSync,
  mkdirSync,
  openSync,
  opendirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import matter from 'gray-matter'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, '..', 'dist')

function envPort(names, fallback) {
  for (const name of names) {
    const raw = process.env[name]?.trim()
    if (!raw) continue
    const port = Number(raw)
    if (Number.isInteger(port) && port > 0 && port <= 65535) return port
  }
  return fallback
}

const PORT = envPort(['ARTEMIS_WEB_PORT', 'PORT'], 5173)
const MCP_WS_PORT = envPort(['ARTEMIS_MCP_WS_PORT', 'MCP_WS_PORT', 'WS_PORT'], 9710)
const MCP_WS_UI_PORT = envPort(['ARTEMIS_MCP_WS_UI_PORT', 'ARTEMIS_MCP_UI_PORT', 'MCP_WS_UI_PORT', 'WS_UI_PORT'], 9711)

function isInsideRelativePath(relative) {
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function resolveInside(root, target) {
  const normalizedTarget = path.normalize(target)
  if (path.isAbsolute(normalizedTarget)) return null
  const candidate = path.normalize(`${root}${path.sep}${normalizedTarget}`)
  return isInsideRelativePath(path.relative(root, candidate)) ? candidate : null
}

function readUtf8File(filePath) {
  const fd = openSync(filePath, 'r')
  try {
    return readFileSync(fd, 'utf-8')
  } finally {
    closeSync(fd)
  }
}

function pathStats(filePath) {
  const fd = openSync(filePath, 'r')
  try {
    return fstatSync(fd)
  } finally {
    closeSync(fd)
  }
}

function pathExists(filePath) {
  try {
    pathStats(filePath)
    return true
  } catch {
    return false
  }
}

function pathIsDirectory(filePath) {
  try {
    return pathStats(filePath).isDirectory()
  } catch {
    return false
  }
}

function resolveUserPath(input) {
  const trimmed = String(input ?? '').trim()
  if (!trimmed) return trimmed
  if (trimmed === '~') return os.homedir()
  if (trimmed.startsWith('~/') || trimmed.startsWith(`~${path.sep}`)) {
    return path.resolve(os.homedir(), trimmed.slice(2))
  }
  if (path.isAbsolute(trimmed)) return path.resolve(trimmed)

  const cwdCandidate = path.resolve(process.cwd(), trimmed)
  if (pathExists(cwdCandidate)) return cwdCandidate
  return path.resolve(os.homedir(), trimmed)
}

function defaultWebVaultRoot() {
  const configuredRoot = process.env.ARTEMIS_WEB_VAULT_ROOT?.trim()
    || process.env.TOLARIA_WEB_VAULT_ROOT?.trim()
  if (configuredRoot) return resolveUserPath(configuredRoot)

  const rootGit = path.resolve('/root/git')
  return pathIsDirectory(rootGit) ? rootGit : path.join(os.homedir(), 'Artemis Vault')
}

function directoryEntries(dir) {
  const directory = opendirSync(dir)
  try {
    const entries = []
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

function streamFile(filePath) {
  const fd = openSync(filePath, 'r')
  return createReadStream(null, { fd, autoClose: true })
}

function staticAssetPath(url) {
  const pathname = new URL(url, 'http://localhost').pathname
  const requested = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '')
  return resolveInside(DIST_DIR, requested) ?? path.normalize(`${DIST_DIR}${path.sep}index.html`)
}

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.apng': 'image/apng',
  '.avif': 'image/avif',
  '.bmp':  'image/bmp',
  '.gif':  'image/gif',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.pdf':  'application/pdf',
  '.tif':  'image/tiff',
  '.tiff': 'image/tiff',
  '.webp': 'image/webp',
  '.woff2':'font/woff2',
  '.json': 'application/json',
}

function findMarkdownFiles(dir) {
  const results = []
  try {
    for (const entry of directoryEntries(dir)) {
      const full = resolveInside(dir, entry.name)
      if (!full) continue
      if (entry.isDirectory()) results.push(...findMarkdownFiles(full))
      else if (entry.name.endsWith('.md')) results.push(full)
    }
  } catch {}
  return results
}

function buildFolderTree(dir, vaultRoot) {
  const nodes = []
  try {
    for (const entry of directoryEntries(dir)) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const full = resolveInside(dir, entry.name)
      if (!full) continue
      nodes.push({
        name: entry.name,
        path: path.relative(vaultRoot, full).replaceAll(path.sep, '/'),
        children: buildFolderTree(full, vaultRoot),
      })
    }
  } catch {}
  return nodes.sort((a, b) => a.name.localeCompare(b.name))
}

function extractWikiLinks(value) {
  if (!value) return []
  const str = Array.isArray(value) ? value.join(' ') : String(value)
  return [...str.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => `[[${m[1]}]]`)
}

function parseMarkdownFile(filePath) {
  try {
    const raw = readUtf8File(filePath)
    const { data: fm, content } = matter(raw)
    const stat = pathStats(filePath)

    const DEDICATED = new Set(['aliases','Is A','Belongs to','Related to','Status','Owner','Cadence','Created at'])
    const relationships = {}
    for (const [k, v] of Object.entries(fm)) {
      if (DEDICATED.has(k)) continue
      const links = extractWikiLinks(v)
      if (links.length) relationships[k] = links
    }

    const bodyText = content.replace(/---[\s\S]*?---/, '').trim()
    const h1 = bodyText.match(/^#\s+(.+)/m)?.[1]
    const aliases = Array.isArray(fm.aliases) ? fm.aliases : fm.aliases ? [fm.aliases] : []

    return {
      path: filePath,
      filename: path.basename(filePath),
      title: h1 || aliases[0] || path.basename(filePath, '.md'),
      isA: fm['Is A'] ?? null,
      aliases,
      belongsTo: extractWikiLinks(fm['Belongs to']),
      relatedTo: extractWikiLinks(fm['Related to']),
      status: fm['Status'] ?? null,
      owner: fm['Owner'] ?? null,
      cadence: fm['Cadence'] ?? null,
      modifiedAt: stat.mtimeMs,
      createdAt: fm['Created at'] ? new Date(fm['Created at']).getTime() : null,
      fileSize: stat.size,
      snippet: bodyText.replace(/^#+\s+.+/gm, '').replace(/\n+/g, ' ').trim().slice(0, 200),
      relationships,
    }
  } catch { return null }
}

function candidateGitBinaries() {
  return [
    process.env.ARTEMIS_GIT_BINARY?.trim() || process.env.TOLARIA_GIT_BINARY?.trim() || process.env.GIT_BINARY?.trim(),
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Git', 'cmd', 'git.exe') : undefined,
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'Git', 'cmd', 'git.exe') : undefined,
    'git',
  ].filter(Boolean)
}

function resolveGitBinary() {
  for (const candidate of candidateGitBinaries()) {
    if (candidate === 'git' || pathExists(candidate)) return candidate
  }
  return 'git'
}

function gitCommand(gitRoot, args) {
  return execFileSync(resolveGitBinary(), ['-C', gitRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function tryGitCommand(gitRoot, args) {
  try {
    return gitCommand(gitRoot, args)
  } catch {
    return null
  }
}

function gitAuthorName() {
  return process.env.ARTEMIS_GIT_AUTHOR_NAME?.trim()
    || process.env.TOLARIA_GIT_AUTHOR_NAME?.trim()
    || process.env.GIT_AUTHOR_NAME?.trim()
    || process.env.USERNAME?.trim()
    || process.env.USER?.trim()
    || 'Artemis Web'
}

function gitAuthorEmail() {
  return process.env.ARTEMIS_GIT_AUTHOR_EMAIL?.trim()
    || process.env.TOLARIA_GIT_AUTHOR_EMAIL?.trim()
    || process.env.GIT_AUTHOR_EMAIL?.trim()
    || 'artemis@localhost'
}

function ensureGitCommitIdentity(gitRoot) {
  if (!tryGitCommand(gitRoot, ['config', '--get', 'user.name'])?.trim()) {
    gitCommand(gitRoot, ['config', 'user.name', gitAuthorName()])
  }

  if (!tryGitCommand(gitRoot, ['config', '--get', 'user.email'])?.trim()) {
    gitCommand(gitRoot, ['config', 'user.email', gitAuthorEmail()])
  }
}

function gitErrorMessage(err, fallback) {
  const stderr = err && typeof err === 'object' ? String(err.stderr ?? '').trim() : ''
  if (stderr) return stderr
  return err instanceof Error && err.message.trim() ? err.message : fallback
}

function isCheckedOutBranchPushError(message) {
  const lower = message.toLowerCase()
  return lower.includes('refusing to update checked out branch') || lower.includes('branch is currently checked out')
}

function gitPushErrorResult(message) {
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

function findGitRoot(filePath) {
  let dir = pathStats(filePath).isDirectory() ? filePath : path.dirname(filePath)
  while (true) {
    if (pathExists(path.join(dir, '.git'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function gitRootForVaultPath(rawVaultPath) {
  if (!rawVaultPath) return null
  const vaultPath = resolveUserPath(rawVaultPath)
  if (!pathExists(vaultPath)) return null
  return findGitRoot(vaultPath)
}

function normalizeGitRelativePath(relativePath) {
  return relativePath.replace(/^"|"$/g, '').replaceAll('\\', '/')
}

function absoluteGitPath(gitRoot, relativePath) {
  return path.resolve(gitRoot, ...relativePath.split('/'))
}

function statusFromPorcelain(code) {
  if (code.includes('D')) return 'deleted'
  if (code.includes('R')) return 'renamed'
  if (code.includes('A') || code === '??') return code === '??' ? 'untracked' : 'added'
  return 'modified'
}

function parseGitStatusLine(gitRoot, line) {
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

function gitModifiedFiles(gitRoot) {
  const output = tryGitCommand(gitRoot, ['status', '--porcelain=v1', '--untracked-files=all'])
  if (!output) return []
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => parseGitStatusLine(gitRoot, line))
    .filter(Boolean)
}

function gitFileHistory(filePath) {
  const gitRoot = findGitRoot(filePath)
  if (!gitRoot) return []
  const relativePath = path.relative(gitRoot, filePath).replaceAll(path.sep, '/')
  const output = tryGitCommand(gitRoot, ['log', '--follow', '--format=%H%x1f%h%x1f%an%x1f%ct%x1f%s', '--', relativePath])
  if (!output) return []
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [hash = '', shortHash = '', author = '', date = '0', message = ''] = line.split('\x1f')
      return { hash, shortHash, author, date: Number(date) || 0, message }
    })
    .filter((commit) => commit.hash.length > 0)
}

function gitRemoteStatus(gitRoot) {
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

function gitCurrentBranch(gitRoot) {
  return tryGitCommand(gitRoot, ['rev-parse', '--abbrev-ref', 'HEAD'])?.trim()
    || tryGitCommand(gitRoot, ['branch', '--show-current'])?.trim()
    || 'master'
}

function gitHasUpstream(gitRoot) {
  return Boolean(tryGitCommand(gitRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])?.trim())
}

function gitEnsureUpstream(gitRoot) {
  if (gitHasUpstream(gitRoot)) return true

  const branch = gitCurrentBranch(gitRoot)
  if (!branch || branch === 'HEAD') return false

  tryGitCommand(gitRoot, ['fetch', 'origin', branch])
  const remoteRef = tryGitCommand(gitRoot, ['rev-parse', '--verify', `origin/${branch}`])?.trim()
  if (!remoteRef) return false

  tryGitCommand(gitRoot, ['branch', '--set-upstream-to', `origin/${branch}`, branch])
  return true
}

function localRemotePath(gitRoot, remoteUrl) {
  const trimmed = remoteUrl?.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('file://')) return path.resolve(trimmed.slice('file://'.length))
  if (trimmed.includes('://') || (trimmed.includes('@') && trimmed.includes(':'))) return null
  return path.isAbsolute(trimmed) ? path.resolve(trimmed) : path.resolve(gitRoot, trimmed)
}

function configureLocalRemoteForCheckedOutPush(gitRoot) {
  const remotePath = localRemotePath(gitRoot, tryGitCommand(gitRoot, ['remote', 'get-url', 'origin']))
  if (!remotePath || !pathExists(remotePath)) return false

  try {
    gitCommand(remotePath, ['config', 'receive.denyCurrentBranch', 'updateInstead'])
    return true
  } catch {
    return false
  }
}

function runGitPush(gitRoot) {
  if (gitHasUpstream(gitRoot)) return gitCommand(gitRoot, ['push'])

  return gitCommand(gitRoot, ['push', '--set-upstream', 'origin', gitCurrentBranch(gitRoot)])
}

function gitPush(gitRoot) {
  try {
    return runGitPush(gitRoot)
  } catch (err) {
    if (isCheckedOutBranchPushError(gitErrorMessage(err, 'Push failed')) && configureLocalRemoteForCheckedOutPush(gitRoot)) {
      return runGitPush(gitRoot)
    }
    throw err
  }
}

function gitPull(gitRoot) {
  if (!gitEnsureUpstream(gitRoot)) {
    return 'No upstream branch exists yet. Push first to publish this branch, then pull will track it.'
  }
  return gitCommand(gitRoot, ['pull', '--no-rebase'])
}

function gitCommitUrl(gitRoot, hash) {
  const remote = tryGitCommand(gitRoot, ['remote', 'get-url', 'origin'])?.trim()
  if (!remote) return null
  const httpsMatch = remote.match(/^https:\/\/github\.com\/(.+?)(?:\.git)?$/)
  const sshMatch = remote.match(/^git@github\.com:(.+?)(?:\.git)?$/)
  const repo = httpsMatch?.[1] ?? sshMatch?.[1]
  return repo ? `https://github.com/${repo}/commit/${hash}` : null
}

function gitLastCommitInfo(gitRoot) {
  const output = tryGitCommand(gitRoot, ['log', '-1', '--format=%H%x1f%h'])?.trim()
  if (!output) return null
  const [hash = '', shortHash = ''] = output.split('\x1f')
  return shortHash ? { shortHash, commitUrl: gitCommitUrl(gitRoot, hash) } : null
}

function gitConflictFiles(gitRoot) {
  const output = tryGitCommand(gitRoot, ['diff', '--name-only', '--diff-filter=U'])
  return output ? output.split(/\r?\n/).filter(Boolean) : []
}

function prepareCloneDestination(localPath) {
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

function cloneGitRepository(repoUrl, localPath) {
  const trimmedUrl = String(repoUrl ?? '').trim()
  const trimmedPath = String(localPath ?? '').trim()
  if (!trimmedUrl || !trimmedPath) throw new Error('Repository URL and local path are required')

  const destination = prepareCloneDestination(trimmedPath)
  execFileSync(resolveGitBinary(), ['clone', '--quiet', trimmedUrl, destination], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return destination
}

function sendJson(res, payload, statusCode = 200) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function readRequestBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
  })
}

async function readJsonBody(req) {
  const body = await readRequestBody(req)
  return body ? JSON.parse(body) : {}
}

async function handleVaultPost(req, res, params) {
  if (params.pathname === '/api/vault/git/init' && req.method === 'POST') {
    const { vaultPath: rawVaultPath } = await readJsonBody(req)
    const vaultPath = rawVaultPath ? resolveUserPath(rawVaultPath) : ''
    if (!vaultPath || !pathIsDirectory(vaultPath)) {
      sendJson(res, { error: 'Invalid vault path' }, 400)
      return true
    }
    gitCommand(vaultPath, ['init'])
    sendJson(res, null)
    return true
  }

  if (params.pathname === '/api/vault/git/clone' && req.method === 'POST') {
    try {
      const { url, localPath } = await readJsonBody(req)
      sendJson(res, cloneGitRepository(url, localPath))
    } catch (err) {
      sendJson(res, { error: gitErrorMessage(err, 'Clone failed') }, 500)
    }
    return true
  }

  if (params.pathname === '/api/vault/git/add-remote' && req.method === 'POST') {
    try {
      const { vaultPath: rawVaultPath, remoteUrl } = await readJsonBody(req)
      const gitRoot = gitRootForVaultPath(rawVaultPath)
      const trimmedRemoteUrl = String(remoteUrl ?? '').trim()
      if (!gitRoot) {
        sendJson(res, { status: 'error', message: 'Not a git repository' })
        return true
      }
      if (!trimmedRemoteUrl) {
        sendJson(res, { status: 'error', message: 'Remote URL is required' })
        return true
      }
      const existingRemote = tryGitCommand(gitRoot, ['remote', 'get-url', 'origin'])?.trim()
      if (existingRemote) {
        if (existingRemote === trimmedRemoteUrl) {
          sendJson(res, { status: 'already_configured', message: 'Remote is already configured' })
          return true
        }
        gitCommand(gitRoot, ['remote', 'set-url', 'origin', trimmedRemoteUrl])
        sendJson(res, { status: 'connected', message: 'Remote updated' })
        return true
      }
      gitCommand(gitRoot, ['remote', 'add', 'origin', trimmedRemoteUrl])
      sendJson(res, { status: 'connected', message: 'Remote connected' })
    } catch (err) {
      sendJson(res, { status: 'error', message: gitErrorMessage(err, 'Could not connect remote') })
    }
    return true
  }

  if (params.pathname === '/api/vault/git/commit' && req.method === 'POST') {
    try {
      const { vaultPath: rawVaultPath, message } = await readJsonBody(req)
      const gitRoot = gitRootForVaultPath(rawVaultPath)
      const commitMessage = String(message ?? '').trim()
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
    } catch (err) {
      sendJson(res, { error: gitErrorMessage(err, 'Commit failed') }, 500)
    }
    return true
  }

  if (params.pathname === '/api/vault/git/push' && req.method === 'POST') {
    try {
      const { vaultPath: rawVaultPath } = await readJsonBody(req)
      const gitRoot = gitRootForVaultPath(rawVaultPath)
      if (!gitRoot) {
        sendJson(res, { status: 'error', message: 'Not a git repository' })
        return true
      }
      const output = gitPush(gitRoot).trim()
      sendJson(res, { status: 'ok', message: output || 'Push complete' })
    } catch (err) {
      const message = gitErrorMessage(err, 'Push failed')
      sendJson(res, gitPushErrorResult(message))
    }
    return true
  }

  if (params.pathname === '/api/vault/git/pull' && req.method === 'POST') {
    let gitRoot = null
    try {
      const { vaultPath: rawVaultPath } = await readJsonBody(req)
      gitRoot = gitRootForVaultPath(rawVaultPath)
      if (!gitRoot) {
        sendJson(res, { status: 'no_remote', message: 'Not a git repository', updatedFiles: [], conflictFiles: [] })
        return true
      }
      if (!gitRemoteStatus(gitRoot).hasRemote) {
        sendJson(res, { status: 'no_remote', message: 'No remote configured', updatedFiles: [], conflictFiles: [] })
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
      })
    } catch (err) {
      const conflictFiles = gitRoot ? gitConflictFiles(gitRoot) : []
      sendJson(res, {
        status: conflictFiles.length > 0 ? 'conflict' : 'error',
        message: conflictFiles.length > 0 ? `Merge conflict in ${conflictFiles.length} file(s)` : gitErrorMessage(err, 'Pull failed'),
        updatedFiles: [],
        conflictFiles,
      })
    }
    return true
  }

  if (params.pathname === '/api/vault/git/discard' && req.method === 'POST') {
    try {
      const { vaultPath: rawVaultPath, relativePath } = await readJsonBody(req)
      const gitRoot = gitRootForVaultPath(rawVaultPath)
      const normalizedRelativePath = normalizeGitRelativePath(String(relativePath ?? ''))
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
    } catch (err) {
      sendJson(res, { error: gitErrorMessage(err, 'Discard failed') }, 500)
    }
    return true
  }

  if (params.pathname === '/api/vault/delete' && req.method === 'POST') {
    try {
      const { path: rawFilePath, paths: rawPaths } = await readJsonBody(req)
      const requestedPaths = Array.isArray(rawPaths) ? rawPaths : rawFilePath ? [rawFilePath] : []
      if (!requestedPaths.length) {
        sendJson(res, { error: 'Missing path' }, 400)
        return true
      }

      const deletedPaths = []
      for (const rawPath of requestedPaths) {
        const filePath = resolveUserPath(rawPath)
        if (!pathExists(filePath) || !pathStats(filePath).isFile()) continue
        rmSync(filePath, { force: true })
        deletedPaths.push(filePath)
      }

      sendJson(res, Array.isArray(rawPaths) ? deletedPaths : (deletedPaths[0] ?? null))
    } catch (err) {
      sendJson(res, { error: gitErrorMessage(err, 'Delete failed') }, 500)
    }
    return true
  }

  if (params.pathname === '/api/vault/save' && req.method === 'POST') {
    const { path: rawPath, content } = await readJsonBody(req)
    if (!rawPath || content === undefined) {
      sendJson(res, { error: 'bad path' }, 400)
      return true
    }
    const filePath = resolveUserPath(rawPath)
    mkdirSync(path.dirname(filePath), { recursive: true })
    writeFileSync(filePath, content, 'utf-8')
    sendJson(res, null)
    return true
  }

  if (params.pathname === '/api/vault/create-empty' && req.method === 'POST') {
    const { targetPath } = await readJsonBody(req)
    if (!targetPath) {
      sendJson(res, { error: 'bad path' }, 400)
      return true
    }
    const resolved = resolveUserPath(targetPath)
    mkdirSync(resolved, { recursive: true })
    sendJson(res, resolved)
    return true
  }

  return false
}

async function serveVaultApi(req, res) {
  const url = req.url ?? '/'
  const params = new URL(url, 'http://localhost')

  if (params.pathname === '/api/vault/ping') {
    sendJson(res, { ok: true })
    return true
  }

  if (params.pathname === '/api/vault/default-path') {
    sendJson(res, defaultWebVaultRoot())
    return true
  }

  if (params.pathname === '/api/vault/resolve-path') {
    sendJson(res, resolveUserPath(params.searchParams.get('path') ?? ''))
    return true
  }

  if (params.pathname === '/api/vault/exists') {
    const dir = resolveUserPath(params.searchParams.get('path') ?? '')
    sendJson(res, Boolean(dir && pathIsDirectory(dir)))
    return true
  }

  if (params.pathname === '/api/vault/list') {
    const dir = resolveUserPath(params.searchParams.get('path') ?? '')
    if (!dir || !pathExists(dir)) {
      sendJson(res, { error: 'bad path' }, 400); return true
    }
    const entries = findMarkdownFiles(dir).map(parseMarkdownFile).filter(Boolean)
    sendJson(res, entries)
    return true
  }

  if (params.pathname === '/api/vault/folders') {
    const dir = resolveUserPath(params.searchParams.get('path') ?? '')
    if (!dir || !pathExists(dir)) {
      sendJson(res, { error: 'bad path' }, 400); return true
    }
    sendJson(res, buildFolderTree(dir, dir))
    return true
  }

  if (params.pathname === '/api/vault/asset') {
    const file = resolveUserPath(params.searchParams.get('path') ?? '')
    if (!file || !pathExists(file) || !pathStats(file).isFile()) {
      sendJson(res, { error: 'bad path' }, 400); return true
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' })
    streamFile(file).pipe(res)
    return true
  }

  if (params.pathname === '/api/vault/content') {
    const file = resolveUserPath(params.searchParams.get('path') ?? '')
    if (!file || !pathExists(file)) {
      sendJson(res, { error: 'bad path' }, 400); return true
    }
    sendJson(res, { content: readUtf8File(file) })
    return true
  }

  if (params.pathname === '/api/vault/all-content') {
    const dir = resolveUserPath(params.searchParams.get('path') ?? '')
    if (!dir || !pathExists(dir)) {
      sendJson(res, { error: 'bad path' }, 400); return true
    }
    const map = {}
    for (const f of findMarkdownFiles(dir)) {
      try { map[f] = readUtf8File(f) } catch {}
    }
    sendJson(res, map)
    return true
  }

  if (params.pathname === '/api/vault/history') {
    const file = resolveUserPath(params.searchParams.get('path') ?? '')
    if (!file || !pathExists(file)) {
      sendJson(res, { error: 'bad path' }, 400); return true
    }
    sendJson(res, gitFileHistory(file))
    return true
  }

  if (params.pathname === '/api/vault/changes') {
    const gitRoot = gitRootForVaultPath(params.searchParams.get('vaultPath'))
    sendJson(res, gitRoot ? gitModifiedFiles(gitRoot) : [])
    return true
  }

  if (params.pathname === '/api/vault/diff') {
    const file = resolveUserPath(params.searchParams.get('path') ?? '')
    if (!file || !pathExists(file)) {
      sendJson(res, { error: 'bad path' }, 400); return true
    }
    const gitRoot = findGitRoot(file)
    if (!gitRoot) {
      sendJson(res, '')
      return true
    }
    const relativePath = path.relative(gitRoot, file).replaceAll(path.sep, '/')
    sendJson(res, tryGitCommand(gitRoot, ['diff', '--', relativePath]) ?? '')
    return true
  }

  if (params.pathname === '/api/vault/diff-at-commit') {
    const file = resolveUserPath(params.searchParams.get('path') ?? '')
    const commitHash = params.searchParams.get('commitHash') ?? ''
    if (!file || !pathExists(file)) {
      sendJson(res, { error: 'bad path' }, 400); return true
    }
    const gitRoot = findGitRoot(file)
    if (!gitRoot || !commitHash) {
      sendJson(res, '')
      return true
    }
    const relativePath = path.relative(gitRoot, file).replaceAll(path.sep, '/')
    sendJson(res, tryGitCommand(gitRoot, ['show', '--format=', '--patch', commitHash, '--', relativePath]) ?? '')
    return true
  }

  if (params.pathname === '/api/vault/git/is-repo') {
    sendJson(res, Boolean(gitRootForVaultPath(params.searchParams.get('vaultPath'))))
    return true
  }

  if (params.pathname === '/api/vault/git/remote-status') {
    const gitRoot = gitRootForVaultPath(params.searchParams.get('vaultPath'))
    sendJson(res, gitRoot ? gitRemoteStatus(gitRoot) : { branch: '', ahead: 0, behind: 0, hasRemote: false, remoteUrl: null, gitRoot: null })
    return true
  }

  if (params.pathname === '/api/vault/git/last-commit') {
    const gitRoot = gitRootForVaultPath(params.searchParams.get('vaultPath'))
    sendJson(res, gitRoot ? gitLastCommitInfo(gitRoot) : null)
    return true
  }

  if (params.pathname === '/api/vault/pulse') {
    sendJson(res, [])
    return true
  }

  if (params.pathname === '/api/vault/git/conflicts') {
    const gitRoot = gitRootForVaultPath(params.searchParams.get('vaultPath'))
    sendJson(res, gitRoot ? gitConflictFiles(gitRoot) : [])
    return true
  }

  const handledPost = await handleVaultPost(req, res, params)
  if (handledPost) return true

  return false
}

const server = http.createServer(async (req, res) => {
  const url = req.url ?? '/'

  if (new URL(url, 'http://localhost').pathname === '/api/mcp/info') {
    sendJson(res, {
      wsUrl: `ws://localhost:${MCP_WS_PORT}`,
      uiWsUrl: `ws://localhost:${MCP_WS_UI_PORT}`,
      wsPort: MCP_WS_PORT,
      uiPort: MCP_WS_UI_PORT,
      available: true,
    })
    return
  }

  // API routes
  if (url.startsWith('/api/vault/')) {
    if (!await serveVaultApi(req, res)) {
      res.writeHead(404); res.end()
    }
    return
  }

  // Static files
  let filePath = staticAssetPath(url)
  if (!pathExists(filePath) || pathStats(filePath).isDirectory()) {
    filePath = path.normalize(`${DIST_DIR}${path.sep}index.html`) // SPA fallback
  }
  const ext = path.extname(filePath)
  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' })
  streamFile(filePath).pipe(res)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Artemis web server running on http://0.0.0.0:${PORT}`)
})
