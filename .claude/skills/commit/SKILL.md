---
name: commit
description: Create a git commit for the current changes in this project. Reviews the diff, runs the typecheck, stages only intended files, and writes a Conventional Commits message. Use when the user asks to commit, save their work to git, or runs /commit.
argument-hint: "[optional: message hint or files to include]"
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git rev-parse:*), Bash(git add:*), Bash(git commit:*), Bash(npm run typecheck)
---

# Commit changes

Create one well-scoped commit for the current work. Extra instructions from the user (may be empty): $ARGUMENTS

## 1. Check the repository

- Run `git rev-parse --is-inside-work-tree`.
  - If this is not a git repository, **stop and ask** the user whether to initialise one. If they agree, run `git init -b main`, then continue.
- Run `git status --short` and `git branch --show-current`.
- If there is nothing to commit, say so and stop.
- If a merge, rebase or cherry-pick is in progress, stop and tell the user. Do not try to finish it.

## 2. Review what changed

- Run `git diff` (unstaged) and `git diff --cached` (staged) and read them.
- Run `git log --oneline -10` (skip on a fresh repo) to match the existing message style.
- If the user named specific files in the instructions above, commit only those.
- If the changes cover unrelated concerns (for example a new feature and an unrelated config tweak), suggest separate commits and ask which to commit first.

## 3. Never commit these

Do not stage these, even if they show up as untracked. If one is already staged, unstage it with `git restore --staged <path>` and tell the user:

- Secrets: `.env*`, `.dev.vars*`, `*.pem`, `*.key`, and any file containing API keys, tokens or passwords
- Build output and local state: `node_modules/`, `.next/`, `.vercel/`, `*.tsbuildinfo`
- Editor or OS clutter: `.DS_Store`, `*.log`

If the diff contains something that looks like a secret (a long random string assigned to a `key`, `token`, `secret` or `password` field), stop and ask the user before committing.

## 4. Verify the code

- Run `npm run typecheck`.
- If it fails, show the errors and ask whether to fix them first or commit anyway. Do not commit failing code without the user's explicit approval.
- Do not run `npm run build` here. It needs Node >= 22.23 and is slow; the typecheck is enough before a commit.

## 5. Stage and commit

- Stage files by explicit path: `git add <path> <path> ...`. Avoid `git add -A` / `git add .` so nothing unexpected gets included.
- Write the message in Conventional Commits format:

  ```
  <type>(<optional scope>): <imperative summary, under 72 chars, no trailing period>

  <optional body: what changed and why, wrapped at 72 chars>
  ```

  Types: `feat` (new feature), `fix` (bug fix), `refactor`, `style` (formatting or CSS only), `docs`, `test`, `chore` (deps, config, tooling), `perf`, `build`, `ci`.
  Scopes for this project: `ui`, `layout`, `api`, `config`, `deps`, `vercel`, or a feature name such as `cart` or `catalog`.

  Examples:
  - `feat(catalog): add product listing page`
  - `chore(deps): pin Next.js version`
  - `fix(layout): keep footer at bottom on short pages`

- Add any attribution lines that the session's instructions require at the end of the message.
- Commit with a heredoc so multi-line messages keep their formatting:

  ```bash
  git commit -F - <<'EOF'
  feat(catalog): add product listing page

  Lists products from the static seed data with name, price and image.
  EOF
  ```

## 6. Rules

- Never push, force-push, amend or rebase unless the user explicitly asks.
- Never use `--no-verify`. If a pre-commit hook fails, fix the problem and make a **new** commit; do not amend.
- Never change git config (user name, email and so on).
- If the commit fails, report the exact error rather than retrying blindly.

## 7. Report

Finish with the short commit hash, the commit subject, and the list of files included. Mention anything you deliberately left out and why.
