# Imgen Studio Claude 操作 Bug 记录

每次开新分支 / 执行 merge 前，必须先阅读此文件。

---

## BUG-001 · feature 分支未合并进 main 即关闭

**发生时间：** 2026-03-23  
**严重程度：** 🔴 高（功能丢失）  
**分支：** `feature/chinese-ui`

### 现象
用户要求「完成并结束分支」后，中文/英文切换功能从界面消失。  
后续在 `feature/app-logo-splash` 分支和 `main` 上均无该功能。

### 根因
执行「结束分支」流程时，只将 worktree 分支（`claude/inspiring-cohen`）的改动 merge 进了 `feature/chinese-ui`，**没有最终将 `feature/chinese-ui` merge 进 `main`**。  
随后新分支从未包含中文 UI 的 `main` 切出，导致功能永久缺失。

### 修复
2026-03-23 补充 merge：`git merge --no-ff feature/chinese-ui`，无冲突。

### 预防措施
见下方「Merge 前检查清单」。

---

## BUG-002 · 多步 Edit 拼接 JSX 导致缩进错误引发编译失败

**发生时间：** 2026-03-31
**严重程度：** 🔴 高（前端整体失效，所有改动不生效）
**分支：** `feat/runs-notification`

### 现象
Next.js / SWC 报 `Unexpected token. Expected jsx identifier` 语法错误，Fast Refresh 失败，前端所有改动全部不生效，用户在界面上看不到任何变化。

### 根因
对同一个 JSX 文件（`AppShell.tsx`）分两步 `Edit`，第一步加了开标签 `<RunsNotificationProvider>`，第二步补了闭标签。拼接后新标签与 `<LocaleProvider>` 处于同一缩进层级，SWC 编译器解析 JSX 嵌套关系失败。

```jsx
// ❌ 错误：两个标签同缩进，SWC 报 Syntax Error
<LocaleProvider>
<RunsNotificationProvider>
  <div>...</div>
</RunsNotificationProvider>
</LocaleProvider>

// ✅ 正确：子标签必须比父标签多缩进一级
<LocaleProvider>
  <RunsNotificationProvider>
    <div>...</div>
  </RunsNotificationProvider>
</LocaleProvider>
```

### 修复
用 `Write` 整体重写 `AppShell.tsx`，保证缩进层级正确，编译恢复正常。

### 预防措施
- 对 JSX 文件做多步 Edit 后，**必须用 `Read` 检查完整文件**，确认所有标签缩进层级正确
- 凡是新增 Provider / Wrapper 嵌套，优先用 `Write` 整体重写，而非多次 `Edit` 拼接
- 改动 JSX 文件后，检查 `/tmp/imagen-frontend.log` 确认 `✓ Compiled` 无报错再收工

---

## Merge 前检查清单（每次必做）

在执行任何 `git merge` / 「完成并结束分支」之前，按顺序确认：

- [ ] `git log --oneline main..feature/xxx` — 确认本次分支的所有 commit 都将被带入 main
- [ ] `git log --oneline --graph --all | head -20` — 可视化确认所有 feature 分支状态
- [ ] 检查本文件（BUGS.md）中的历史 bug，确认本次操作不会重蹈覆辙
- [ ] merge 完成后：`git log --oneline main | head -5` — 验证 feature 的最新 commit 已出现在 main
- [ ] 如有多个 feature 分支同时存在，逐一确认哪些已 merge、哪些还没有

