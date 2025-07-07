# CSS Render VSCode Extension

这个扩展为 [css-render](https://github.com/07akioni/css-render) 提供了基础的代码补全

## 功能

- **代码补全**: 在 css-render 的 CSS 字符串中提供 CSS 属性和值的自动完成

## 支持的函数

扩展支持以下 css-render 函数：

- `c()` - 基础 CSS 规则
- `cB()` - BEM 块 (Block)
- `cE()` - BEM 元素 (Element)
- `cM()` - BEM 修饰符 (Modifier)
- `cNotM()` - BEM 非修饰符 (Not Modifier)

## 支持的场景

### 1. 基本 CSS 字符串

```typescript
import { c, cB, cE, cM } from 'css-render'

// 第二个参数为字符串的情况 - 支持语法高亮和自动补全
const style = c('.my-class', `
  color: red;
  font-size: 16px;
  background-color: blue;
  border: 1px solid #ccc;
`)

// BEM 插件用法
const buttonStyle = cB('button', `
  padding: 10px 20px;
  border-radius: 4px;
  background-color: #007acc;
`, [
  cE('icon', `
    margin-right: 8px;
    font-size: 14px;
  `),
  cM('primary', `
    background-color: #0066cc;
    border: 2px solid #0066cc;
  `),
])
```

## 支持的文件类型

- `.cssr.[t|j]s` - 支持 TypeScript 和 JavaScript 文件中的 css-render 函数调用

## 特性

### 代码补全
- 提供 CSS 属性和值的自动补全

## 使用方法

1. 安装扩展
2. 在支持的文件类型中使用 css-render 函数
3. 在 CSS 字符串中输入时，将自动触发代码补全


## 配置选项

扩展提供了以下配置选项：

- `cssRender.enable`: 启用/禁用整个扩展 (默认: true)
- `cssRender.completion.enable`: 启用/禁用自动补全 (默认: true)

## 许可证

MIT License