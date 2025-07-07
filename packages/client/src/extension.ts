import * as vscode from 'vscode'
import { cssrProvider } from './CSSRenderProvider'

export function isInCssrFile(document: vscode.TextDocument): boolean {
  const fileName = document.fileName
  return fileName.endsWith('.cssr.ts') || fileName.endsWith('.cssr.js')
}

export function activate(context: vscode.ExtensionContext) {
  vscode.window.showInformationMessage('CSS Render 扩展已激活！')

  const cssrProviderInst = cssrProvider()
  console.log('✅ CSS Render 提供程序已创建')

  const cssrCompletionProvider = vscode.languages.registerCompletionItemProvider(
    [
      { scheme: 'file', pattern: '**/*.cssr.[jt]s' },
    ],
    {
      async provideCompletionItems(document, position, _token, _context) {
        console.log('🔍 补全提供程序被调用')
        console.log('📁 文件名:', document.fileName)
        console.log('📍 语言ID:', document.languageId)
        console.log('📍 位置:', `${position.line}:${position.character}`)

        const isCSSRFile = isInCssrFile(document)

        console.log('🎯 是否为 CSS Render 文件:', isCSSRFile)

        if (!isCSSRFile) {
          console.log('❌ 不是 CSS Render 文件，跳过补全')
          return undefined
        }

        console.log('✅ 开始提供 CSS Render 补全建议')

        try {
          const mockDocument = {
            getText: () => document.getText(),
            offsetAt: (pos: vscode.Position) => document.offsetAt(pos),
          }

          const completions = await cssrProviderInst.provideCompletions(mockDocument, position)

          console.log(`🎉 找到 ${completions.items.length} 个补全项`)

          if (completions.items.length > 0) {
            console.log('📝 补全项预览:', completions.items.slice(0, 3).map(item =>
              typeof item.label === 'string' ? item.label : item.label.label,
            ))
          }

          return new vscode.CompletionList(
            completions.items.map((item) => {
              const vsItem = new vscode.CompletionItem(
                typeof item.label === 'string' ? item.label : item.label.label,
                item.kind,
              )

              if (item.detail)
                vsItem.detail = item.detail

              if (item.documentation) {
                if (typeof item.documentation === 'string')
                  vsItem.documentation = item.documentation
                else
                  vsItem.documentation = new vscode.MarkdownString(item.documentation.value)
              }

              if (item.insertText)
                vsItem.insertText = item.insertText

              if (item.sortText)
                vsItem.sortText = item.sortText

              return vsItem
            }),
            completions.isIncomplete,
          )
        }
        catch (error) {
          console.error('❌ CSS Render 补全提供程序错误:', error)
          return undefined
        }
      },
    },
    ':',
    ' ',
    '-',
    '\n',
    '{',
    ';',
  )

  const diagnosticCollection = vscode.languages.createDiagnosticCollection('css-render')

  const diagnosticProvider = vscode.workspace.onDidChangeTextDocument((event) => {
    if (isInCssrFile(event.document))
      updateDiagnostics(event.document, diagnosticCollection, cssrProviderInst)
  })

  const activeEditorProvider = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && isInCssrFile(editor.document))
      updateDiagnostics(editor.document, diagnosticCollection, cssrProviderInst)
  })

  const testCommand = vscode.commands.registerCommand('cssRender.test', () => {
    vscode.window.showInformationMessage('CSS Render 扩展正在工作！🎉')
    console.log('📋 测试命令被调用')
  })

  context.subscriptions.push(
    cssrCompletionProvider,
    diagnosticCollection,
    diagnosticProvider,
    activeEditorProvider,
    testCommand,
  )

  console.log('🎯 CSS Render 扩展注册完成')

  const activeEditor = vscode.window.activeTextEditor
  if (activeEditor) {
    console.log('📝 当前活动编辑器:', activeEditor.document.fileName)
    if (isInCssrFile(activeEditor.document))
      console.log('✅ 当前文件是 CSS Render 文件，扩展应该能工作')
  }
}

function updateDiagnostics(
  document: vscode.TextDocument,
  collection: vscode.DiagnosticCollection,
  provider: ReturnType<typeof cssrProvider>,
) {
  try {
    const diagnostics = provider.validateCSS(document)

    const vsDiagnostics = diagnostics.map((diag) => {
      const range = new vscode.Range(
        new vscode.Position(diag.range.start.line, diag.range.start.character),
        new vscode.Position(diag.range.end.line, diag.range.end.character),
      )

      const severity = diag.severity === 'error'
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning

      return new vscode.Diagnostic(range, diag.message, severity)
    })

    collection.set(document.uri, vsDiagnostics)
  }
  catch (error) {
    console.error('更新诊断信息时出错:', error)
  }
}

export function deactivate() {
  console.log('CSS Render 扩展已停用')
}
