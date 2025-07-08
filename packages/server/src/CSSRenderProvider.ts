import { getCSSLanguageService } from 'vscode-css-languageservice'
import type { Stylesheet } from 'vscode-css-languageservice'
import {
  type CompletionItem,
  type CompletionList,
  type Diagnostic,
  type Hover,
  Position,
  Range,
} from 'vscode-languageserver-types'
import { TextDocument } from 'vscode-languageserver-textdocument'

interface CSSRenderRegion {
  start: number
  end: number
  content: string
}

class CompletionCache {
  private cache = new Map<string, CompletionItem[]>()
  private maxSize = 100

  get(key: string): CompletionItem[] | undefined {
    return this.cache.get(key)
  }

  set(key: string, value: CompletionItem[]): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey)
        this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  clear(): void {
    this.cache.clear()
  }
}

export class CSSRenderProvider {
  private cssLanguageService = getCSSLanguageService()
  private virtualDocumentContents = new Map<string, string>()
  private completionCache = new CompletionCache()
  private enhancedCompletion = false

  public initialize(options?: { enhancedCompletion?: boolean }) {
    this.enhancedCompletion = !!options?.enhancedCompletion
    console.log(`Enhanced completion mode: ${this.enhancedCompletion}`)
  }

  public get triggerCharacters(): string[] {
    if (this.enhancedCompletion) {
      return 'abcdefghijklmnopqrstuvwxyz'.split('')
    }
    return ['.', ':', '-', '/', '[', ']', '@', ' ']
  }

  private findCssr(document: TextDocument, position: Position): CSSRenderRegion | null {
    const text = document.getText()
    const offset = document.offsetAt(position)
    const cssrRegions = this.findCssrRegions(text)

    for (const region of cssrRegions) {
      if (offset >= region.start && offset <= region.end) {
        const regionWithContent = {
          ...region,
          content: text.substring(region.start, region.end),
        }
        return regionWithContent
      }
    }

    return null
  }

  private findCssrRegions(text: string): Array<{ start: number, end: number }> {
    const regions = []
    const regex = /(?:c|cB|cE|cM|cNotM)(?:<[^>]*>)?\s*\(\s*(?:['"`][^'"`]*['"`]\s*,\s*)?`([^`]*?)`/g

    for (const match of text.matchAll(regex)) {
      if (match.index === undefined) continue
      const start = match.index + match[0].indexOf('`') + 1
      const end = start + match[1].length
      regions.push({ start, end })
    }

    return regions
  }

  private shouldProvideAutocomplete(document: TextDocument, position: Position): boolean {
    const region = this.findCssr(document, position)
    return !!region
  }

  doComplete(
    document: TextDocument,
    position: Position,
  ): CompletionList | null {
    try {
      if (!this.shouldProvideAutocomplete(document, position))
        return null

      const region = this.findCssr(document, position)
      if (!region)
        return null

      const { virtualDocument, virtualPosition, originalPosition } = this.getVirtual(
        document,
        position,
        region,
      )

      const stylesheet = this.cssLanguageService.parseStylesheet(
        virtualDocument,
      ) as Stylesheet

      const cssCompletions = this.cssLanguageService.doComplete(
        virtualDocument,
        virtualPosition,
        stylesheet,
      )

      if (cssCompletions) {
        cssCompletions.isIncomplete = true
        cssCompletions.items.forEach((item) => {
          if (item.textEdit && 'range' in item.textEdit) {
            item.textEdit.range = this.toOriginalRange(item.textEdit.range, originalPosition)
          }
        })
        cssCompletions.items = this.deduplicateCompletions(cssCompletions.items)
      }

      return cssCompletions
    }
    catch (error) {
      console.error('Error in doComplete:', error)
      return null
    }
  }

  private deduplicateCompletions(items: CompletionItem[]): CompletionItem[] {
    const seen = new Set<string>()
    return items.filter((item) => {
      const key = `${item.label}-${item.kind}`
      if (seen.has(key))
        return false
      seen.add(key)
      return true
    })
  }

  doValidation(document: TextDocument): Diagnostic[] {
    const text = document.getText()
    const regions = this.findCssrRegions(text)
    if (!regions.length)
      return []

    const diagnostics: Diagnostic[] = []
    for (const region of regions) {
      const regionWithContent = {
        ...region,
        content: text.substring(region.start, region.end),
      }
      const { virtualDocument, originalPosition } = this.getVirtual(
        document,
        document.positionAt(region.start),
        regionWithContent,
      )
      const stylesheet = this.cssLanguageService.parseStylesheet(
        virtualDocument,
      ) as Stylesheet
      const diagnostic = this.cssLanguageService.doValidation(
        virtualDocument,
        stylesheet,
      )
      diagnostic.forEach((d) => {
        const originalRange = this.toOriginalRange(d.range, originalPosition)
        diagnostics.push({ ...d, range: originalRange })
      })
    }
    return diagnostics
  }

  doHover(document: TextDocument, position: Position): Hover | null {
    const region = this.findCssr(document, position)
    if (!region)
      return null

    const { virtualDocument, virtualPosition } = this.getVirtual(
      document,
      position,
      region,
    )
    const stylesheet = this.cssLanguageService.parseStylesheet(virtualDocument)
    const hover = this.cssLanguageService.doHover(
      virtualDocument,
      virtualPosition,
      stylesheet,
    )

    if (hover && hover.range) {
      const { originalPosition: virtualOriginalPosition } = this.getVirtual(document, position, region)
      hover.range = this.toOriginalRange(hover.range, virtualOriginalPosition)
    }

    return hover
  }

  private getVirtual(
    document: TextDocument,
    position: Position,
    region: { start: number, end: number, content: string },
  ) {
    const virtualContent = `* {\n${region.content}\n}`
    const virtualDocument = TextDocument.create(
      `${document.uri}.virtual.css`,
      'css',
      0,
      virtualContent,
    )
    this.virtualDocumentContents.set(document.uri, virtualDocument.getText())

    const regionStartPos = document.positionAt(region.start)
    const currentOffset = document.offsetAt(position)
    const relativeOffset = currentOffset - region.start
    const prefixLength = `* {\n`.length
    const virtualOffset = prefixLength + relativeOffset
    const virtualPosition = virtualDocument.positionAt(virtualOffset)

    return {
      virtualDocument,
      virtualPosition,
      originalPosition: regionStartPos,
    }
  }

  private toOriginalRange(range: Range, originalPosition: Position): Range {
    const start = Position.create(
      originalPosition.line + range.start.line - 1,
      (range.start.line === 1 ? originalPosition.character : 0) + range.start.character,
    )
    const end = Position.create(
      originalPosition.line + range.end.line - 1,
      (range.end.line === 1 ? originalPosition.character : 0) + range.end.character,
    )
    return Range.create(start, end)
  }

  onDocumentRemoved(document: TextDocument) {
    this.virtualDocumentContents.delete(document.uri)
    this.completionCache.clear()
  }

  dispose() {
    this.virtualDocumentContents.clear()
    this.completionCache.clear()
  }
}
