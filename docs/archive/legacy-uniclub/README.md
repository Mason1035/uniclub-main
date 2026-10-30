# UniClub 历史资料归档

归档日期：2026-10-10。

这里保存原 UniClub 项目的旧说明和阶段记录。文中的品牌、演示账号、端口、接口、资源路径及环境配置反映历史实现；当前开发和部署请使用[项目 README](../../../README.md)及各业务模块的现行说明。

## 已归档的说明

- [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- [BACKEND_COMPLETION_SUMMARY.md](BACKEND_COMPLETION_SUMMARY.md)
- [CUSTOMIZATION_GUIDE.md](CUSTOMIZATION_GUIDE.md)
- [ENV_SAFETY_GUIDE.md](ENV_SAFETY_GUIDE.md)
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- [NEWS_CURATION_GUIDE.md](NEWS_CURATION_GUIDE.md)
- [NEWS_CURATION_IMPLEMENTATION.md](NEWS_CURATION_IMPLEMENTATION.md)
- [PERFORMANCE_OPTIMIZATION.md](PERFORMANCE_OPTIMIZATION.md)
- [QUICK_START_WINDOWS.md](QUICK_START_WINDOWS.md)
- [RESOURCE_TRACKING_IMPLEMENTATION.md](RESOURCE_TRACKING_IMPLEMENTATION.md)
- [TOKEN_FIX_SUMMARY.md](TOKEN_FIX_SUMMARY.md)
- [WINDOWS_SETUP.md](WINDOWS_SETUP.md)
- [cursor-rules.txt](cursor-rules.txt)：原根目录 `.cursorrules`，仅作为历史规则保存。

## 旧活动导入脚本

旧活动照片清理后，以下脚本移出后端工具目录，以 `.js.txt` 保留原实现，供历史参考：

- [upload-aws-hackathon-gallery.js.txt](scripts/upload-aws-hackathon-gallery.js.txt)
- [upload-cursor-workshop-gallery.js.txt](scripts/upload-cursor-workshop-gallery.js.txt)
- [upload-cometville-gallery.js.txt](scripts/upload-cometville-gallery.js.txt)

这些脚本记录了当时的相对路径和数据库写入操作，不是现行可执行入口。

## 本轮资源清理

- 删除 `public/aws hackathon/`、`public/cursor workshop/`、`public/cometville/` 中的旧活动照片。
- 删除原社团的 `public/Assets/` 图标和 Logo。
- 删除 `public/fonts/` 根目录中的旧 Noto/Geist 分片、CSS 和配套 OFL 文件；保留正式字体 `public/fonts/classhub/`。
- 删除旧版 `public/branding/classhub-logo.png`、`public/branding/classhub-favicon.png`。
- 保留 `logo/` 中的三份素材及对应副本，包括 `public/branding/classhub-mark-v2.png`。
- 清理 Vite 开发缓存、独立首页原型的生成目录和项目内 `.DS_Store`；正式 `dist/` 通过构建更新。

## 清理后验证

- `npm run build` 通过，包含 TypeScript 检查、Vite 构建和公开页面 HTML 生成。
- `npm run test:seo`：11 项通过。
- 正式 199 份字体及 `dist/` 副本的大小、SHA-256 与现行字体 manifest 一致。
- 当前品牌图片、PWA 图标、默认头像、桌宠许可文件和三组重复素材均保留；重复素材的内容哈希与清理前一致。
- 按 `du -k` 的磁盘占用口径，`public/` 约 85.3 → 30.4 MiB，`dist/` 约 87.4 → 37.7 MiB。
