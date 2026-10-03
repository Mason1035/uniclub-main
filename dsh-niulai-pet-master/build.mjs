/**
 * dsh-niulai-pet 构建脚本（产物契约照 dsh client 插件惯例，同 dsh-browser-fs）：
 * 只产 lib/client.js（CJS 闭包，首尾包装 window.__ModuleLoader__.load）。
 * host 半 index.js 是纯 ESM 源码（注册 settings 命名空间），不经构建。
 * react / react/jsx-runtime 由 dsh 运行时模块表提供（platform seed），
 * 标 external 与官方 bundle 一致。安装即市场的 shim 挂载，刷新页面生效，
 * 更新免重启。
 *
 * 素材（assets/*.png|*.mp3）以 dataurl 内联进 bundle：换素材 = 替换 assets/
 * 下的文件后 `npm run build`，再刷新页面即可。assets/ 素材
 * 管线见 README。
 */
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const PLUGIN_ID = 'dsh-niulai-pet'
// 版本号构建期从 package.json 注入（关于面板用），发版 bump 后自动跟随
const VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version
const define = {
  __NIULAI_VERSION__: JSON.stringify(VERSION),
  // 悬浮设置面板自带 react-dom：不打这个 define 会吃进 dev 版 react-dom，
  // 其 act() 环境检测读平台 prod react 没有的 ReactCurrentActQueue 直接炸（踩过）
  'process.env.NODE_ENV': '"production"',
}

await build({
  bundle: true,
  sourcemap: false,
  minify: false,
  logLevel: 'info',
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  define,
  // react 由 dsh 运行时模块表提供（platform seed），同官方 bundle 的 external 约定
  external: ['react', 'react/jsx-runtime'],
  jsx: 'automatic',
  loader: {
    '.png': 'dataurl',
    '.webp': 'dataurl',
    '.mp3': 'dataurl',
  },
  banner: {
    js: [
      `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      'var module = { exports: {} }; var exports = module.exports;',
    ].join('\n'),
  },
  footer: {
    js: 'return module.exports; } });',
  },
})

console.log('build ok: lib/client.js (browser, cjs closure, assets inlined)')

// standalone 试玩页 bundle：与插件同一套 pet.ts + SKINS（src/client/demo.ts），
// iife 单文件、素材同样内联，demo/index.html 直接 <script> 引入即可玩。
await build({
  bundle: true,
  sourcemap: false,
  minify: true,
  logLevel: 'info',
  entryPoints: ['src/client/demo.ts'],
  outfile: 'demo/niulai-standalone.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  define,
  loader: {
    '.png': 'dataurl',
    '.webp': 'dataurl',
    '.mp3': 'dataurl',
  },
})

console.log('build ok: demo/niulai-standalone.js (browser, iife, assets inlined)')
