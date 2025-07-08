import { defineConfig } from 'tsup'

export default defineConfig([
  // Client build
  {
    entry: ['packages/client/src/extension.ts'],
    outDir: 'dist',
    format: ['cjs'],
    shims: false,
    dts: false,
    bundle: true,
    minify: true,
    external: ['vscode'],
    outExtension: () => ({
      js: '.js'
    })
  },
  // Server build
  {
    entry: ['packages/server/src/server.ts'],
    outDir: 'dist',
    format: ['cjs'],
    shims: false,
    dts: false,
    minify: true,
    external: [],
    bundle: true,
    outExtension: () => ({
      js: '.js'
    })
  }
])
