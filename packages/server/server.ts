import { getLanguageService } from 'vscode-html-languageservice'
import type { InitializeParams } from 'vscode-languageserver'
import { ProposedFeatures, TextDocumentSyncKind, TextDocuments, createConnection } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

const connection = createConnection(ProposedFeatures.all)

const documents = new TextDocuments(TextDocument)

const htmlLanguageService = getLanguageService()

connection.onInitialize((_params: InitializeParams) => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: {
        resolveProvider: false,
      },
    },
  }
})

connection.onCompletion(async (textDocumentPosition, _token) => {
  const document = documents.get(textDocumentPosition.textDocument.uri)
  if (!document)
    return null

  return htmlLanguageService.doComplete(
    document,
    textDocumentPosition.position,
    htmlLanguageService.parseHTMLDocument(document),
  )
})

documents.listen(connection)
connection.listen()
