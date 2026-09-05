# Brclio Robot · 编程机器人

真正可编程的儿童机器人工作台。使用图形积木安排路线，在 SVG 地图中逐格执行、收集星星、观察结果并修改程序。默认简体中文，无需实体硬件或后端。

[在线体验](https://chechezjx.github.io/brclio-robot/) · [GitHub 仓库](https://github.com/chechezjx/brclio-robot) · [构建状态](https://github.com/chechezjx/brclio-robot/actions) · [部署指南](docs/DEPLOYMENT.md)

## 开始运行

需要 **Node.js 24.x**，推荐 `.nvmrc` 指定的 **24.19.0**。项目使用 **pnpm 11.19.0**，直接依赖固定精确版本，提交了 `pnpm-lock.yaml`。

```sh
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm dev
```

打开终端显示的本地地址（默认 `http://localhost:5173`）。应用入口就是编程工作台。

```sh
pnpm typecheck          # TypeScript 类型检查
pnpm test               # 70 个核心逻辑、播放器、存储与编辑模型测试
pnpm test:watch         # 监听单元测试
pnpm build              # 类型检查 + 生产构建，产物在 dist/
pnpm preview            # 本地检查生产产物
pnpm exec playwright install chromium
pnpm test:e2e           # 浏览器验收；自动启动/复用 5173 开发服务器
pnpm build:deploy      # 单元测试 + 类型检查 + 生产构建
pnpm test:deploy        # 检查生产包在根目录与 GitHub Pages 子目录的完整闭环
```

也可以使用已安装的 Microsoft Edge 运行浏览器测试，免于下载 Playwright Chromium。在 PowerShell 中执行：

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
pnpm test:e2e
```

## 已实现

- 12 个原创教学关卡和自由实验室，逐步开放顺序、步数、转向、后退、两层循环及 A/B 动作组合。所有关卡可直接选择，无倒计时或失败惩罚。
- 独立 SVG 地图与原创机器人。地图尺寸通过关卡数据支持 4×4～12×12；朝向为北、东、南、西。逐格碰撞、边界阻挡、拾星、轨迹、动作计数。
- 可拖入、点击插入、调序、编辑数字、复制、删除的图形积木。循环有真实子节点和容器边界；同一套插入目标用于鼠标和触屏。
- 非拖拽操作：选中积木后使用按钮或键盘调序、删除，使用「移到」跨主程序、循环及函数区域移动。50 步编辑撤销/重做；清空前确认。
- 从初始状态运行、暂停、继续、一个原子动作的单步、立即重置。运行与暂停期间锁定编辑和导入。暂停时主按钮变为「继续」；要重新从起点运行，先重置。
- 函数与循环内执行位置、高亮调用处、步数与轮次、0.5×/1×/2×速度、可关闭轨迹、声音和减少动画。操作系统减少动画设置也会生效。
- 独立关卡草稿、完成记录、当前关卡和设置自动保存在 localStorage；单关程序 JSON 导入导出。损坏或不可用的存储显示提示，不导致白屏。
- 手机在地图/编程板间切换；地图视图保留固定播放控制。平板上下布局，桌面双栏。主要操作目标至少 48px，提供键盘焦点。
- 无登录、支付、排行榜、云数据库、追踪脚本或个人资料收集。核心图片、图标和字体均不依赖外部资源请求。

## 使用方法

1. 观察机器人头顶的小箭头、星星与旗子；小箭头代表它的正前方。
2. 点击积木库或拖到编程板。选中积木时，新积木插在它后面；点击区域末尾「+」或「添加到里面」后，新积木进入该区域。目标区域会显示提示与轮廓。
3. 数字附在动作上：前进/后退 1～9 格；重复 2～9 次。把动作放入重复容器后才能运行。
4. 从第 10 关开始，在动作组合 A/B 区定义动作，再在主程序放入「执行 A/B」。函数定义本身不自动执行。
5. 运行或单步观察。遇到障碍或越界立即停止在最后合法位置。修改前点「重置」，原来的积木仍会保留。
6. **程序正常结束时停在旗子上，并收集所有星星，才算通关。** 提前经过终点、离开终点或之后碰撞都不会成功。自由练习只判断程序是否正常完成。

键盘：Tab 移动焦点，Enter 激活按钮；积木上 `Alt + ←/→` 调序，`Delete` 删除；编程板内 `Ctrl/⌘ + Z` 撤销，`Ctrl/⌘ + Shift + Z` 重做。可用屏幕上的调序按钮与「移到」完成相同操作。

## 项目结构

```text
src/
  components/           原创 Robot、无障碍 Modal、可选 Web Audio 提示音
  features/
    editor/             dnd-kit 积木编辑器和纯数据编辑操作
    simulator/          SVG 地图、轨迹和运行状态展示
  engine/
    validation.ts       不可信程序校验、节点/层级限制、递归检测
    interpreter.ts      惰性解释器、原子动作、地图规则、结束判断
    player.ts           唯一定时器、速度、暂停继续与生命周期取消
  data/levels.ts        12 个教学关卡、自由练习、结构化参考解
  storage/local.ts      本地恢复、故障处理、JSON 导入导出
  types/index.ts        关卡、程序、运行、编辑历史、通关和设置类型
  styles/               工作台主题与响应式样式
  tests/                70 个单元测试
  App.tsx               应用状态、关卡任务、设置、保存和各模块组合
e2e/app.spec.ts          12 个真实浏览器验收测试
docs/TESTING.md          实际验证结果、覆盖内容与限制
public/robot.svg         本地原创图标
```

### 程序与运行语义

程序是版本化的数据树：

```json
{
  "version": 1,
  "levelId": "level-10",
  "main": [{ "id": "main-call-a", "type": "call", "function": "A" }],
  "functions": {
    "A": [
      { "id": "a-forward", "type": "forward", "steps": 3 },
      { "id": "a-turn", "type": "right" }
    ],
    "B": []
  }
}
```

以上只是函数格式示例，完整参考解位于关卡数据中。所有 ID 在主程序和两个函数中全局唯一。循环结构为 `{ "id": "loop-1", "type": "repeat", "times": 2, "body": [...] }`。不存在独立数字指令。

解释器使用生成器惰性遍历程序，不使用 `eval`、`new Function` 或任意 JavaScript 拼接。每次 `step()` 只改变一次机器人状态；预读仅处理控制结构和判断是否结束，不会提前执行下一个动作。成功判断仅发生在正常程序结束时。原始关卡对象不被修改。

统一预算为 **2000 次解释器推进**，指令分派、循环轮次、函数调用和原子动作均消耗预算，动作数与预算是两个不同指标。预算在预读阶段触发也会及时终止。支持最多 **250 个节点**、每个程序/函数体最多 **两层词法循环嵌套**，不预先展开。最多两个函数，禁止直接或间接递归，包括未调用函数中的递归。

播放器只有一个定时器，动作是同步原子状态迁移，CSS 只展示位移。暂停时当前状态已经提交，动画可完成当前位移，下一动作不会开始。重置/切关/卸载递增执行代次并清理定时器，旧回调不能更新机器人。导入另有操作代次，防止读取期间发生切关、运行或编辑后，旧文件覆盖新草稿。

### 导入校验

只接收至多 256 KB 的 JSON，校验版本、关卡标识、明确字段、指令类型、整数参数、全树 ID、250 节点上限、两层循环、空循环、函数引用、递归和本关允许指令/积木数量限制。未知字段和资源地址被拒绝。只有完整验证成功才替换草稿，可撤销。

本地草稿允许暂时未完成的函数与空循环，以保留编辑进度；运行和导入会做更严格的可执行性校验。因此未完成的空循环/未定义函数草稿可以导出备份，但需补全后才能通过严格导入。

## 新增关卡

1. 在 `src/data/levels.ts` 增加 `Level` 数据：唯一 `id`、标题、故事、学习目标、宽高、起点与朝向、终点、障碍、星星、`allowed`、分级提示与 `solution`。
2. 坐标左上角为 `(0,0)`，x 向右、y 向下；方向使用 `N/E/S/W`。确保全部点位在界内，障碍不与机器人起点、必需星星或终点重合。
3. 参考解必须是相同的 `Program` 数据结构，并使用唯一 ID。`maxBlocks` 可选，统计主程序、循环体和 A/B 定义中的所有实体积木。
4. 将关卡加入 `levels`（自由地图放入相应集合）。如果超出当前 12 关课程范围，还需更新导航/进度中显式的 12 与章节分组。
5. 运行 `pnpm test`；`allLevels` 的每个参考解都会被同一 `runToEnd()` 自动验证。不要硬编码展示路线。

## 新增指令

1. 扩展 `types/index.ts` 的 `Block` 判别联合和 `InstructionType`。
2. 在 `validation.ts` 添加字段及参数校验，保持未知字段拒绝；必要时递增文件版本并增加显式迁移。
3. 在 `interpreter.ts` 的惰性遍历与原子动作处理处定义语义，并明确其预算消耗。
4. 在 `editor/model.ts` 添加默认数据，在 `Editor.tsx` 添加名称、图标、参数控件和编辑交互，在 CSS 添加颜色变量；不能只依赖颜色表达含义。
5. 更新适用关卡的 `allowed`，加入正常执行、边界、单步和导入验证测试。动画继续只读取解释器状态。

## 静态部署

已提供 **Vercel 即导入即部署配置**、**GitHub CI** 和 **GitHub Pages 自动发布工作流**。Vercel 直接导入 GitHub 仓库；Pages 首次在 Settings → Pages 选择 GitHub Actions。详细步骤、权限、路径适配与排错见 [部署指南](docs/DEPLOYMENT.md)。

本仓库 `chechezjx/brclio-robot` 已启用 Pages。连接 Vercel 时，在 [新建项目](https://vercel.com/new) 中导入本仓库，即可继续使用同一仓库自动部署。

若要复制一份项目到自己的 GitHub 账号，可使用下面的按钮；它会创建新仓库并部署到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fchechezjx%2Fbrclio-robot)

执行 `pnpm build` 后，把 **`dist/` 内的全部文件**部署到任意静态服务器，如 Nginx、GitHub Pages、Netlify、Cloudflare Pages。无需后端、环境密钥、运行时 API 或数据库。Vite `base: './'` 支持子目录部署，没有前端路由重写要求。请通过 HTTP(S) 访问，不要直接双击 `index.html` 使用 `file://`。

仓库的 `.openai/hosting.json` 仅用于当前 Sites 交付，不是运行依赖；其他静态托管平台无需使用它。私有 Sites 预览的访问控制由托管平台提供，应用本身没有账号系统。浏览器存储按来源隔离，localhost、私有预览和你自己的域名不会自动共享草稿；可以导出再导入。

## 已知限制与明确未实现

- 第一版为本地单人应用；不做账号、支付、排行榜、多端云同步、多人协作、实体机器人、AI 聊天、后台或云数据库。
- 暂无可视化地图创作器；新增地图和教学关卡通过 TypeScript 数据完成。自由练习使用固定的 8×8 地图。
- 导出是当前关卡的程序文件，不包含整个浏览器的全部进度与设置。清除浏览器数据可能丢失本地存档。
- 编辑历史只保留当前会话最多 50 次，切关会重建该关历史；程序草稿会保留。
- 数量限制只约束程序积木数，不强制唯一解或必须使用某种教学策略；孩子可以探索其他合法路线。
- 浏览器测试在 Windows Microsoft Edge（Chromium）实际运行。手机和平板触屏为浏览器设备模拟和真实 touch 事件注入，未执行实体设备、Safari、Firefox、屏幕阅读器或系统高对比度测试。
- 没有 Service Worker/PWA 离线安装；页面加载后核心操作无后端依赖，重新加载仍需静态服务器可访问。

## 官方 API 参考

使用当前安装的 **`@dnd-kit/react 0.5.0`**，API 为 `DragDropProvider`、`useDraggable`、`useDroppable`；没有混用旧的 `@dnd-kit/core`。参见 [官方 React Quickstart](https://dndkit.com/react/quickstart/) 和 [useDraggable](https://dndkit.com/react/hooks/use-draggable/)。

开发与测试配置依据 [Vite 官方指南](https://vite.dev/guide/)、[Vitest fake timers](https://vitest.dev/guide/mocking/timers) 和 [Playwright 浏览器配置](https://playwright.dev/docs/test-use-options)。实际安装版本在 `package.json` 和锁文件中。
