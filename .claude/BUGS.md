# BuyBox Claude 操作 Bug 记录

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

## Merge 前检查清单（每次必做）

在执行任何 `git merge` / 「完成并结束分支」之前，按顺序确认：

- [ ] `git log --oneline main..feature/xxx` — 确认本次分支的所有 commit 都将被带入 main
- [ ] `git log --oneline --graph --all | head -20` — 可视化确认所有 feature 分支状态
- [ ] 检查本文件（BUGS.md）中的历史 bug，确认本次操作不会重蹈覆辙
- [ ] merge 完成后：`git log --oneline main | head -5` — 验证 feature 的最新 commit 已出现在 main
- [ ] 如有多个 feature 分支同时存在，逐一确认哪些已 merge、哪些还没有

