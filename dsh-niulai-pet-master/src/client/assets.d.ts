declare module '*.png' {
  const dataUrl: string
  export default dataUrl
}
declare module '*.webp' {
  const dataUrl: string
  export default dataUrl
}
declare module '*.mp3' {
  const dataUrl: string
  export default dataUrl
}
/** 插件版本号，构建期 define 注入（build.mjs 读 package.json）。 */
declare const __NIULAI_VERSION__: string
