# Vercel 与 GitHub Pages 部署

这是无后端的 Vite 静态应用。不需要 API Key、数据库或运行时环境变量。

公开源码：[chechezjx/brclio-robot](https://github.com/chechezjx/brclio-robot)。GitHub Pages 已启用，地址为 [在线编程工作台](https://chechezjx.github.io/brclio-robot/)，部署状态可在 [Actions](https://github.com/chechezjx/brclio-robot/actions) 查看。

## 推荐：GitHub 仓库连接 Vercel

1. 在 Vercel 选择 **Add New → Project → Import Git Repository**。
2. 选择 `chechezjx/brclio-robot`（或自己的 fork），默认分支为 `main`，Root Directory 保持仓库根目录。
3. 保持 Framework Preset 为 **Vite**；部署设置由仓库中的 `vercel.json` 提供，直接点 Deploy。
4. 后续推送到 `main` 自动更新生产站；其他分支和 PR 由 Vercel Git 集成生成预览。

| 配置         | 项目已提供的值                                                            |
| ------------ | ------------------------------------------------------------------------- |
| Node.js      | `24.x`，来自 `package.json`                                               |
| 包管理器     | 固定 `pnpm@11.19.0`，来自 `packageManager` 与显式安装命令                 |
| 安装         | `npm exec --yes --package=pnpm@11.19.0 -- pnpm install --frozen-lockfile` |
| 构建         | `npm exec --yes --package=pnpm@11.19.0 -- pnpm run build:deploy`          |
| 静态产物     | `dist`                                                                    |
| 必需环境变量 | 无                                                                        |

显式指定 pnpm 是为了避免平台预装版本与锁文件不一致，无需手动设置 Corepack 开关。Vercel 每次构建会先执行 70 个单元测试，再做类型检查和生产构建；任一步失败，本次部署就会失败。GitHub CI 的浏览器测试独立执行，不会被误当成 Vercel 自动部署的前置关卡。

如使用 Vercel CLI，可在仓库根目录运行 `vercel` 创建预览，使用 `vercel --prod` 发布生产版；账号登录和首次关联项目按 Vercel 官方流程完成。不要把 `.vercel` 本地状态或任何 Token 提交到 Git。

## GitHub Pages 自动部署

### 首次启用

1. 打开 GitHub 仓库的 **Settings → Pages**。
2. 将 **Build and deployment → Source** 设为 **GitHub Actions**。
3. 推送到 `main`。先运行 **CI**，全部通过后自动运行 **Deploy GitHub Pages**。
4. 在该工作流的 `github-pages` Environment 中打开最终站点链接。

如果第一次推送时尚未启用 Pages，在完成设置后到 Actions 中选择 **Deploy GitHub Pages → Run workflow → main**。手动发布也会重新运行单元测试、类型检查和构建。

公开仓库可使用免费 GitHub Pages；私有仓库是否支持取决于 GitHub 计划。GitHub Pages 发布的网站通常公开可访问，与源码仓库权限不是同一回事。

### 自动化流程

```text
push main / pull request
  └─ CI
      ├─ 使用 .nvmrc 与 packageManager 安装固定工具版本
      ├─ frozen-lockfile 安装
      ├─ 70 个单元测试 + 类型检查 + 生产构建
      ├─ Chromium 浏览器验收
      └─ 根路径 / 仓库子路径 / 显式 Pages base 构建验证

main 的 push 对应 CI 通过
  └─ Deploy GitHub Pages
      ├─ checkout 同一个通过验证的 commit
      ├─ 从 configure-pages 获取实际 base_path
      ├─ 验证并构建 dist
      └─ 上传静态产物并部署
```

PR 和 fork 不会自动发布。源码构建任务只有读取源码/Pages 配置的权限，发布任务才获得 `pages: write` 与 `id-token: write`，无需手动保存 GitHub Personal Access Token。

## 路径与自定义域名

默认 `base: './'`，静态素材使用相对路径，所以 Vercel 根域名、预览域名、Sites 和普通静态目录都可以加载。

Pages 工作流会把 `actions/configure-pages` 返回的 `base_path` 加 `/` 传给 `VITE_BASE_PATH`。它会自动适配：

- `https://用户名.github.io/仓库名/`
- `https://用户名.github.io/`
- 在 GitHub Pages 设置中绑定的自定义域名

无需把用户名或仓库名写死进源代码。自定义域名仍需在相应托管平台完成 DNS 与域名验证。这个版本没有前端路径路由，不需要 catch-all rewrite；切换关卡不会修改 URL 路径。

本地模拟指定路径（PowerShell）：

```powershell
$env:VITE_BASE_PATH = '/brclio-robot/'
pnpm build
pnpm preview
# 结束预览服务器后，再清除临时变量
Remove-Item Env:VITE_BASE_PATH
```

手动构建完成后应从预览服务器的同名子路径访问。一般部署无需手动设置此变量。

## 本地验收部署产物

```sh
pnpm install --frozen-lockfile
pnpm build:deploy
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:deploy
```

`test:deploy` 会额外生成 `dist-pages`，分别验证相对素材在域名根目录和仓库子目录，以及按显式 base 构建的 Pages 产物。检查 JS、CSS、SVG 图标是否从正确路径返回 200，检查编程运行与刷新恢复。测试用 HTTP 服务器不提供 SPA 回退，素材路径错误会真实返回 404。

Windows 如已安装 Microsoft Edge，可以先设置 `$env:PLAYWRIGHT_CHANNEL = 'msedge'`，然后运行两个浏览器测试命令。GitHub Actions 中使用 Playwright 自带 Chromium。

## 常见问题

- **Vercel 提示 pnpm/lockfile 版本不符**：不要在仪表盘把 Install Command 改为裸的 `pnpm install`，恢复 `vercel.json` 中的固定版本命令。
- **Pages workflow 报找不到 Pages site**：先到 Settings → Pages 把 Source 设置为 GitHub Actions，再手动运行 Pages 工作流。
- **Pages 404**：以成功的部署工作流输出 URL 为准；确认工作流成功，访问仓库对应的子目录地址。
- **CLI 构建没有更新线上网页**：`pnpm build` 只产生本地静态文件。推送到已连接的 GitHub 分支，或使用相应平台部署命令才会发布。
- **换域名后草稿不见了**：localStorage 按浏览器来源隔离。旧地址中的数据还在原来源，可导出 JSON 后到新域名导入。
- **CI 红色但 Vercel 已部署**：Vercel 的本地测试/构建 gate 与 GitHub 浏览器验收是两个流程；查明失败原因后修复，不应把两者状态混为一谈。

## 官方依据

- [Vercel 的 Vite 部署与 Git 集成](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel 包管理器与自定义安装命令](https://vercel.com/docs/package-managers)
- [Vercel 支持的 Node.js 版本](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vite GitHub Pages 部署](https://vite.dev/guide/static-deploy.html#github-pages)
- [GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
