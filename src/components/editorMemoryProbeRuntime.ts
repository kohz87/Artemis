import { callWebBackend } from '../backend/client'
import type { VaultEntry } from '../types'
import type {
  ProbeResult,
  ProbeRunOptions,
  ProbeTarget,
  ProbeTargetSummary,
  ProcessMemorySnapshot,
} from './editorMemoryProbeTypes'

export const DEFAULT_PROBE_LIMIT = 5
export const DEFAULT_PROBE_BATCH_SIZE = 1
export const DEFAULT_PROBE_SETTLE_MS = 700
export const PROBE_READY_TIMEOUT_MS = 30_000

function wait(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function contentBytes(content: string): number {
  return new TextEncoder().encode(content).byteLength
}

export function summarizeTarget({ entry, content }: ProbeTarget): ProbeTargetSummary {
  return {
    path: entry.path,
    fileSize: entry.fileSize,
    contentBytes: contentBytes(content),
    lineCount: content.split('\n').length,
  }
}

export function memoryDelta(
  snapshot: ProcessMemorySnapshot | null,
  baseline: ProcessMemorySnapshot | null,
): number | null {
  if (!snapshot || !baseline) return null
  return snapshot.totalRssBytes - baseline.totalRssBytes
}

export function selectProbeEntries(entries: VaultEntry[], options: ProbeRunOptions): VaultEntry[] {
  const markdownEntries = entries.filter(entry => (entry.fileKind ?? 'markdown') === 'markdown')
  if (options.paths?.length) {
    const wantedPaths = new Set(options.paths)
    return markdownEntries.filter(entry => wantedPaths.has(entry.path))
  }

  return [...markdownEntries]
    .sort((left, right) => right.fileSize - left.fileSize)
    .slice(0, options.limit ?? DEFAULT_PROBE_LIMIT)
}

export function resolveMountCounts(targetCount: number, batchSize: number): number[] {
  const counts: number[] = []
  for (let count = batchSize; count < targetCount; count += batchSize) {
    counts.push(count)
  }
  if (targetCount > 0) counts.push(targetCount)
  return counts
}

export async function readMemorySnapshot(): Promise<ProcessMemorySnapshot | null> {
  return null
}

export async function loadProbeTarget(entry: VaultEntry): Promise<ProbeTarget> {
  const content = await callWebBackend<string>('get_note_content', { path: entry.path })
  return { entry, content }
}

export async function copyProbeResult(result: ProbeResult): Promise<void> {
  await navigator.clipboard?.writeText(JSON.stringify(result, null, 2))
}

export function settleAfterMount(settleMs: number): Promise<void> {
  return wait(settleMs).then(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
}
