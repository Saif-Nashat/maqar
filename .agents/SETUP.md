# Codex setup record

Reviewed 2026-09-20 at repository commit fbcf576. Local checkout: C:\Users\User\Desktop\maqar\maqar. Origin: https://github.com/Saif-Nashat/maqar.git.

## Added

- Root AGENTS.md: repository structure, commands, current booking/payment rules, demo/live parity, EN/AR and RTL conventions, validation, secrets, and external-action boundaries. Existing CLAUDE.md and HANDOVER.md are unchanged.
- skills/create-plan: original project-specific alternative. The current OpenAI curated catalog does not contain create-plan and the experimental catalog returned 404.
- skills/frontend-design: original project-specific alternative. The article's vipulgupta2048/codex-skills download returned 404; no unverified replacement repository was installed.
- skills/gh-address-comments: downloaded using the bundled skill installer from openai/skills, skills/.curated/gh-address-comments, main. Retained helper, assets, metadata, and license. Adapted SKILL.md to honor existing authorization, use supported permissions, and require authorization for posting. The helper has limitations for forks, mixed pagination, and threads over 100 comments; the skill calls these out and directs explicit API pagination when needed.
- skills/stop-slop: downloaded using the bundled skill installer from hardikpandya/stop-slop, main. Retained references, license, README, and changelog. Added a local scope section protecting technical accuracy and Arabic copy.

Downloaded source versions are recorded by installed file hashes in the accompanying setup report. These are vendored files, not auto-updating dependencies. Review upstream changes before updating.

## Article recommendations omitted

- gh-fix-ci: no GitHub Actions workflow is tracked in this checkout; defer until an actual Actions workflow/failed PR check needs it. Existing npm checks are documented in AGENTS.md.
- WarpGrep: native search is sufficient for this repository; no demonstrated need for an API key or external code-search service.
- Valyu: no specialized research requirement for repository setup; avoid an additional authenticated service.
- Superpowers: existing plans remain useful without installing a broad workflow framework. No automatic subagent or plugin behavior added.
- Codex Security: not a local SKILL.md installation. No cloud scan, repository connection, or account change was requested as part of this configuration.

No MCP servers, global Codex settings, app source, lockfiles, existing documents, or VS Code settings changed. No commits, pushes, deployments, or database operations performed.

## Environment and manual prerequisites

Codex CLI 0.155.0-alpha.9.2 and OpenAI VS Code extension folders were found. Git, Node, and Python are present. GitHub CLI was not on PATH. Global config already contains the desktop's node_repl integration; it was preserved. Do not copy its machine-specific configuration into this repository.

For PR comment tasks, install GitHub CLI from https://cli.github.com/ if needed, then run `gh auth login` and `gh auth status` in your own terminal. Authenticate with repository access appropriate to the selected repository; no token belongs in tracked files. This setup does not need authentication for its local planning, UI, or prose skills.

Open this repository folder in VS Code/Codex. The skills are available on the next turn in a repository-scoped session; restart the session if discovery has not refreshed. This setup task itself started outside the repository.

## Sources

- https://medium.com/@unicodeveloper/9-must-have-skills-for-codex-in-2026-b5124b375eec
- https://learn.chatgpt.com/docs/build-skills
- https://learn.chatgpt.com/docs/agent-configuration/agents-md
- https://github.com/openai/skills/tree/main/skills/.curated/gh-address-comments
- https://github.com/hardikpandya/stop-slop
