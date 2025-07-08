import {
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
  createConnection,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { CSSRenderProvider } from './CSSRenderProvider'

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)

const provider = new CSSRenderProvider()

connection.onInitialize((params) => {
  provider.initialize(params.initializationOptions)
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: provider.triggerCharacters,
      },
      hoverProvider: true,
    },
  }
})

connection.onCompletion(async ({ textDocument, position }) => {
  const document = documents.get(textDocument.uri)
  if (!document) {
    return null
  }

  const result = provider.doComplete(document, position)
  return result
})

connection.onHover(async ({ textDocument, position }) => {
  const document = documents.get(textDocument.uri)
  if (!document)
    return null

  return provider.doHover(document, position)
})

documents.onDidChangeContent(async (change) => {
  const diagnostics = await provider.doValidation(change.document)
  connection.sendDiagnostics({ uri: change.document.uri, diagnostics })
})

documents.onDidClose((event) => {
  provider.onDocumentRemoved(event.document)
})

connection.onShutdown(() => {
  provider.dispose()
})

documents.listen(connection)
connection.listen()
