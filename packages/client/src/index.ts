import * as path from 'node:path'
import type { CompletionList, ExtensionContext } from 'vscode'
import { Uri, commands, workspace } from 'vscode'
import { getLanguageService } from 'vscode-html-languageservice'
import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node'
import { LanguageClient, TransportKind } from 'vscode-languageclient/node'
import { getCSSVirtualContent, isInsideStyleRegion } from './embeddedSupport'

let client: LanguageClient

const htmlLanguageService = getLanguageService()

export function activate(context: ExtensionContext) {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'))

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
  }

  const virtualDocumentContents = new Map<string, string>()

  workspace.registerTextDocumentContentProvider('embedded-content', {
    provideTextDocumentContent: (uri) => {
      const originalUri = uri.path.slice(1).slice(0, -4)
      const decodedUri = decodeURIComponent(originalUri)
      return virtualDocumentContents.get(decodedUri)
    },
  })

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'html1' }],
    middleware: {
      provideCompletionItem: async (document, position, context, token, next) => {
        if (!isInsideStyleRegion(htmlLanguageService, document.getText(), document.offsetAt(position)))
          return await next(document, position, context, token)

        const originalUri = document.uri.toString(true)
        virtualDocumentContents.set(originalUri, getCSSVirtualContent(htmlLanguageService, document.getText()))

        const vdocUriString = `embedded-content://css/${encodeURIComponent(
          originalUri,
        )}.css`
        const vdocUri = Uri.parse(vdocUriString)
        return await commands.executeCommand<CompletionList>(
          'vscode.executeCompletionItemProvider',
          vdocUri,
          position,
          context.triggerCharacter,
        )
      },
    },
  }

  client = new LanguageClient(
    'languageServerExample',
    'Language Server Example',
    serverOptions,
    clientOptions,
  )

  client.start()
}

export function deactivate(): Thenable<void> | undefined {
  if (!client)
    return undefined

  return client.stop()
}
