import * as path from 'node:path'
import type { ExtensionContext } from 'vscode'
import { workspace } from 'vscode'
import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node'
import { LanguageClient, TransportKind } from 'vscode-languageclient/node'

let client: LanguageClient

export function activate(context: ExtensionContext) {

  const serverModule = context.asAbsolutePath(
    path.join('packages', 'server', 'dist', 'server.js'),
  )

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: {
      module: serverModule,
      transport: TransportKind.stdio,
    },
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'cssr-ts' },
      { scheme: 'file', language: 'cssr-js' },
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.{ts,js,tsx,jsx}'),
    },
    initializationOptions: {
      enhancedCompletion: true,
    },
    middleware: {
      provideCompletionItem: async (document, position, context, token, next) => {
        if (context.triggerKind === 1) {
          if (context.triggerCharacter) {
            if (!/^[a-zA-Z]$/.test(context.triggerCharacter))
              return
          }
        }
        return next(document, position, context, token)
      },
    },
  }

  client = new LanguageClient(
    'cssRenderLanguageServer',
    'CSS Render Language Server',
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
