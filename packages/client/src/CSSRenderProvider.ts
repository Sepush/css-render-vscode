import type {
  CompletionItem as LSCompletionItem,
  Position,
} from 'vscode-css-languageservice'
import {
  CompletionItemKind,
  Range,
  TextDocument,
  getCSSLanguageService,
} from 'vscode-css-languageservice'
import type { CompletionItem, CompletionList, MarkdownString } from 'vscode'
import { CompletionItemKind as VSCompletionItemKind } from 'vscode'

enum CSSRFnEnum {
  cB = 'cB',
  cE = 'cE',
  cM = 'cM',
  cNotM = 'cNotM',
  c = 'c',
}

export class CSSRCompletionProvider {
  private cssService: ReturnType<typeof getCSSLanguageService>

  constructor() {
    this.cssService = getCSSLanguageService({
      useDefaultDataProvider: true,
    })
  }

  public async provideCompletions(
    document: { getText(): string, offsetAt(position: Position): number },
    position: Position,
  ): Promise<CompletionList> {
    const text = document.getText()
    const offset = document.offsetAt(position)

    const cssContext = this.extractCSSContext(text, offset)

    if (cssContext)
      return this.provideCSSInJSCompletions(cssContext)

    return { isIncomplete: false, items: [] }
  }

  private extractCSSContext(text: string, offset: number): {
    cssContent: string
    cursorInCSS: number
    templateStart: number
    templateEnd: number
    cssrFnType: CSSRFnEnum
  } | null {
    // css-render patterns matching
    const patterns = [
      // cB('tag', `css...`, [...])
      { regex: /cB\s*\(\s*['"][^'"]*['"],\s*`([^`]*)`/g, type: CSSRFnEnum.cB },
      // cE('element', `css...`)
      { regex: /cE\s*\(\s*['"][^'"]*['"],\s*`([^`]*)`/g, type: CSSRFnEnum.cE },
      // cM('modifier', `css...`)
      { regex: /cM\s*\(\s*['"][^'"]*['"],\s*`([^`]*)`/g, type: CSSRFnEnum.cM },
      // cNotM('modifier', `css...`)
      { regex: /cNotM\s*\(\s*['"][^'"]*['"],\s*`([^`]*)`/g, type: CSSRFnEnum.cNotM },
      // c('&:hover', `css...`)
      { regex: /c\s*\(\s*['"][^'"]*['"],\s*`([^`]*)`/g, type: CSSRFnEnum.c },
    ]

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern.regex)

      for (const match of matches) {
        const fullMatch = match[0]
        const cssContent = match[1]
        const matchStart = match.index!

        const templateStart = matchStart + fullMatch.indexOf('`') + 1
        const templateEnd = templateStart + cssContent.length

        if (offset >= templateStart && offset <= templateEnd) {
          return {
            cssContent,
            cursorInCSS: offset - templateStart,
            templateStart,
            templateEnd,
            cssrFnType: pattern.type,
          }
        }
      }
    }

    return null
  }

  private async provideCSSInJSCompletions(
    cssContext: {
      cssContent: string
      cursorInCSS: number
      templateStart: number
      templateEnd: number
      cssrFnType: CSSRFnEnum
    },
  ): Promise<CompletionList> {
    const virtualCSS = this.createVirtualCSSDocument(cssContext.cssContent, cssContext.cssrFnType)

    const virtualDocument = TextDocument.create(
      'virtual://cssr.css',
      'css',
      1,
      virtualCSS,
    )

    const virtualPosition = this.calculateVirtualPosition(
      virtualCSS,
      cssContext.cursorInCSS,
    )

    try {
      const completions = await this.cssService.doComplete(
        virtualDocument,
        virtualPosition,
        this.cssService.parseStylesheet(virtualDocument),
      )

      const items = this.convertCompletionItems(completions?.items || [])

      return {
        isIncomplete: completions?.isIncomplete || false,
        items,
      }
    }
    catch (error) {
      console.error('CSS completion error:', error)
      return { isIncomplete: false, items: [] }
    }
  }

  private createVirtualCSSDocument(cssContent: string, cssrFnType: CSSRFnEnum): string {
    switch (cssrFnType) {
      case CSSRFnEnum.cB:
        return `.component {\n${cssContent}\n}`
      case CSSRFnEnum.cE:
        return `.component__element {\n${cssContent}\n}`
      case CSSRFnEnum.cM:
        return `.component--modifier {\n${cssContent}\n}`
      case CSSRFnEnum.cNotM:
        return `.component:not(.component--modifier) {\n${cssContent}\n}`
      case CSSRFnEnum.c:
        return `.component {\n${cssContent}\n}`
      default:
        return `.default {\n${cssContent}\n}`
    }
  }

  private calculateVirtualPosition(
    virtualCSS: string,
    cursorInCSS: number,
  ): Position {
    const cssStartIndex = virtualCSS.indexOf('{') + 2
    const targetOffset = cssStartIndex + cursorInCSS

    const lines = virtualCSS.substring(0, targetOffset).split('\n')
    const line = lines.length - 1
    const character = lines[line].length

    return { line, character }
  }

  private convertCompletionItems(
    lsItems: LSCompletionItem[],
  ): CompletionItem[] {
    return lsItems.map(item => ({
      label: item.label,
      kind: this.convertCompletionItemKind(item.kind),
      detail: item.detail,
      documentation: this.convertDocumentation(item.documentation),
      insertText: item.insertText || item.label,
      sortText: item.sortText,
      filterText: item.filterText,
    }))
  }

  private convertDocumentation(
    documentation: string | { kind: string, value: string } | undefined,
  ): string | MarkdownString | undefined {
    if (!documentation)
      return undefined

    if (typeof documentation === 'string')
      return documentation

    if (documentation.kind === 'markdown') {
      return {
        value: documentation.value,
        isTrusted: true,
        supportThemeIcons: true,
        supportHtml: false,
      } as MarkdownString
    }

    return documentation.value
  }

  private convertCompletionItemKind(kind?: CompletionItemKind): VSCompletionItemKind {
    switch (kind) {
      case CompletionItemKind.Property:
        return VSCompletionItemKind.Property
      case CompletionItemKind.Value:
        return VSCompletionItemKind.Value
      case CompletionItemKind.Color:
        return VSCompletionItemKind.Color
      case CompletionItemKind.Function:
        return VSCompletionItemKind.Function
      case CompletionItemKind.Unit:
        return VSCompletionItemKind.Unit
      case CompletionItemKind.Keyword:
        return VSCompletionItemKind.Keyword
      default:
        return VSCompletionItemKind.Property
    }
  }

  public validateCSSInJS(document: any): Array<{
    message: string
    range: Range
    severity: 'error' | 'warning'
  }> {
    const text = document.getText()
    const diagnostics: Array<{
      message: string
      range: Range
      severity: 'error' | 'warning'
    }> = []

    const cssContexts = this.findAllCSSContexts(text)

    for (const context of cssContexts) {
      const virtualCSS = this.createVirtualCSSDocument(context.cssContent, context.wrapperType)
      const virtualDocument = TextDocument.create(
        'virtual://css-in-js.css',
        'css',
        1,
        virtualCSS,
      )

      try {
        const stylesheet = this.cssService.parseStylesheet(virtualDocument)
        const cssErrors = this.cssService.doValidation(virtualDocument, stylesheet)

        for (const error of cssErrors) {
          const originalRange = this.convertRangeToOriginal(error.range, context)
          if (originalRange) {
            diagnostics.push({
              message: error.message,
              range: originalRange,
              severity: error.severity === 1 ? 'error' : 'warning',
            })
          }
        }
      }
      catch (error) {
        console.error('CSS validation error:', error)
      }
    }

    return diagnostics
  }

  private findAllCSSContexts(text: string): Array<{
    cssContent: string
    templateStart: number
    templateEnd: number
    wrapperType: CSSRFnEnum
  }> {
    const contexts: Array<{
      cssContent: string
      templateStart: number
      templateEnd: number
      wrapperType: CSSRFnEnum
    }> = []

    const patterns = [
      { regex: /cB\s*\(\s*['"][^'"]*['"],\s*`([^`]*)`/g, type: CSSRFnEnum.cB },
      { regex: /cE\s*\(\s*['"][^'"]*['"],\s*`([^`]*)`/g, type: CSSRFnEnum.cE },
      { regex: /cM\s*\(\s*['"][^'"]*['"],\s*`([^`]*)`/g, type: CSSRFnEnum.cM },
      { regex: /cNotM\s*\(\s*['"][^'"]*['"],\s*`([^`]*)`/g, type: CSSRFnEnum.cNotM },
      { regex: /c\s*\(\s*['"][^'"]*['"],\s*`([^`]*)`/g, type: CSSRFnEnum.c },
    ]

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern.regex)

      for (const match of matches) {
        const fullMatch = match[0]
        const cssContent = match[1]
        const matchStart = match.index!
        const templateStart = matchStart + fullMatch.indexOf('`') + 1
        const templateEnd = templateStart + cssContent.length

        contexts.push({
          cssContent,
          templateStart,
          templateEnd,
          wrapperType: pattern.type,
        })
      }
    }

    return contexts
  }

  private convertRangeToOriginal(
    virtualRange: Range,
    context: { templateStart: number, templateEnd: number },
  ): Range | null {
    const startOffset = context.templateStart + virtualRange.start.character
    const endOffset = context.templateStart + virtualRange.end.character

    return Range.create(
      { line: 0, character: startOffset },
      { line: 0, character: endOffset },
    )
  }
}

export function cssrProvider(): CSSRCompletionProvider {
  return new CSSRCompletionProvider()
}
