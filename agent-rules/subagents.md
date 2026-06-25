# Subagent Development Rules

- When a development plan already exists and includes multiple modules or tasks without strong coupling, prefer using subagents for the actual code or document changes.
- When using subagents, the main agent is responsible for splitting boundaries, providing context, naming the allowed directories/files, and defining acceptance criteria.
- After subagents return, the main agent must inspect the changes for conflicts, missing plan items, legacy compatibility paths, or temporary workarounds, and dispatch rework if needed.
