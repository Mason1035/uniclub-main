# UniClub 历史资料归档

本目录保存从仓库根目录和后端脚本目录移出的 UniClub 时代说明、开发规则和相册导入脚本。它们仅用于追溯历史实现、配置和迁移背景，不是 ClassHub 当前的启动、部署、数据导入或运维指南。

## 归档内容

- 根目录旧说明：API、Windows 开发、新闻整理、性能、资源追踪、环境安全和若干功能完成记录。
- `cursor-rules.txt`：旧版 `.cursorrules`，其中包含旧端口、旧命令和旧项目约定。
- `scripts/`：三个旧相册导入脚本的原始文本副本。脚本曾从 `public/aws hackathon/`、`public/cursor workshop/` 和 `public/cometville/` 读取图片，并写入 MongoDB 的 `PastEvent.gallery`；本次未执行，也不属于当前启动、构建、测试或部署流程。

本次清理删除了上述三个旧照片目录中的 16 张本地源文件，以及原 UniClub `public/Assets/` 中的 6 个旧图标。数据库中已经保存的相册数据不由本次文件清理修改；由于当前工作区没有后端环境文件，未对生产或本地 MongoDB 做动态只读核查。

## 使用说明

归档文档中的路径、端口、密钥名称、命令和产品描述可能已经过时。当前项目入口以根目录 [`README.md`](../../../README.md)、`package.json`、Vite/Vercel 配置和 `deploy/ecs/` 为准。

归档脚本保留为 `.js.txt`，避免被误当作可执行后端脚本。不要直接运行；若未来确需处理历史相册，应先确认数据库记录、备份和资源来源，再由维护者单独制定迁移方案。
