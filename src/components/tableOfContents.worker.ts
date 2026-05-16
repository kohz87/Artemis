/// <reference lib="webworker" />

import { buildTableOfContentsFromMarkdownOnly, type TocItem } from './tableOfContentsModel'

interface TocWorkerRequest {
  entryTitle: string
  markdown: string
  requestId: number
}

interface TocWorkerResponse {
  requestId: number
  toc: TocItem
}

const ctx = self as DedicatedWorkerGlobalScope

ctx.onmessage = (event: MessageEvent<TocWorkerRequest>) => {
  const data = event.data
  const response: TocWorkerResponse = {
    requestId: data.requestId,
    toc: buildTableOfContentsFromMarkdownOnly(data.entryTitle, data.markdown),
  }
  ctx.postMessage(response)
}

export {}
