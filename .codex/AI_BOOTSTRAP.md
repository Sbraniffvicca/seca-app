# AI Bootstrap

This file is for Codex. When Stephen says "check your bootstrap", read this file first.

## Workspace

- Root folder on Windows: `C:\ai_project`
- WSL path: `/mnt/c/ai_project`
- Preferred VS Code mode: `WSL: Ubuntu`
- Current project layout looks like a multi-service app with:
  - `auth-service`
  - `chat-service`
  - `chat-ui`
  - `ddl-scripts`
  - `design-docs`
  - `weaviate-js`
  - archive/older folders under `0archive` and `old-code`

## Operating Notes

- Use Ubuntu WSL for terminal work whenever possible.
- Avoid committing generated dependency folders such as `node_modules`.
- Keep repository-level project memory in this file when it helps future Codex sessions.
- If app-specific startup instructions are discovered, add them below.

## GitHub Setup Notes

- This workspace was not initially a Git repo.
- GitHub CLI was not installed when this bootstrap was created.
- To publish, either install GitHub CLI and run `gh auth login`, or create an empty GitHub repo in the browser and add it as `origin`.
- The root repo was initialized on branch `main`.
- Several service folders contain their own `.git` directories:
  - `auth-service`
  - `chat-service`
  - `chat-ui`
  - archive/vendor folders under `0archive` and `weaviate-js/archive`
- Decide whether SECA should be published as one monorepo or as separate service repos before making the first root commit.
- Large/local folders are ignored at the root: `0archive`, `old-code`, `testing_lm_studio`, `sample attachments`, and saved browser page bundles.
- Hardcoded API keys were found before the first GitHub push. Production source was changed to use `OPENAI_API_KEY` and `OPENROUTER_API_KEY`; scratch `chat-service/infiniteloop` files are ignored.
- Rotate any API keys that were previously hardcoded before relying on this repo as secure.

## App Startup Notes

Not documented yet. Fill this in after confirming the intended SECA service startup flow.
