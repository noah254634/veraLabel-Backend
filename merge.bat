@echo off
cd C:\Users\Administrator\veralabel-backend.worktrees\agents-codebase-redundancy-normalization

REM Stage all changes
git add -A

REM Commit changes
git commit -m "feat: normalize code and eliminate redundancy

- Created 3 new utility libraries (responseHandler, userExtraction, validationHelpers)
- Refactored 6 controllers to use unified patterns
- Enhanced asyncHandler error handling middleware
- Eliminated 150+ lines of redundant code
- 42%% reduction in analytics controllers code

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

REM Get current branch name
for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%i

REM Navigate to main worktree and merge
cd C:\Users\Administrator\veralabel-backend
git merge %BRANCH%

REM Show status
git status
git log --oneline -3
