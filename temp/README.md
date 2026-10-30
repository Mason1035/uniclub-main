# 长征的力量

四川师范大学第二组毛概课实践成果展示。独立 React / TypeScript / Vite 入口，地图与资料浏览均在浏览器运行。

## 本地预览

在项目根目录执行 `npm run temp:dev`，打开 `http://127.0.0.1:8082/temp/`。
`npm run temp:build` 会完成展示页类型检查，并生成 `dist-temp/`；`npm run temp:preview` 可预览构建产物。

## 更新现有 ECS 的 /temp

执行 `bash deploy/ecs/push-temp.sh`。脚本独立构建并上传本展示页，在原域名 Nginx 配置中增加 /temp 入口；保留原站版本与后端服务。
服务器展示页位于 `/opt/classhub/temp/releases/`，`current` 指向当前版本；Nginx 配置在改动前保留备份，并经过语法检查。

## 内容维护

事件在 `src/features/longmarch/data/early.ts`、`late.ts` 中维护；图片来源和本地路径在 `media.ts` 中维护；三例文物在 `artifacts.ts` 中维护。
每个事件的日期、地图坐标、人物、部队、正文与引用来自同一份数据。
图片保存为全图等比压缩 WebP，图注区分当代遗址、环境与文物。官方图片未声明开放许可，原权利保留；再次公开使用请按来源要求核实许可。

地图使用按需加载的 OpenStreetMap 标准瓦片，保留可见署名，不预抓取或离线保存瓦片。瓦片不可用时使用 Natural Earth 公有领域省界数据；连接线仅为事件关联示意，不表示精确行军轨迹。
字体 Noto Serif SC 700 子集及其 OFL 许可均随页面保存。
