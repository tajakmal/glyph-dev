# Ralph Guardrails (Signs)

> Lessons learned from past failures. READ THESE BEFORE ACTING.

## Core Signs

### Sign: Explore Then Act
- **Trigger**: Starting any task
- **Instruction**: First explore the codebase using search tools. Understand existing patterns before making changes. Edit existing files when extending features; only create new files for genuinely new components.
- **Added after**: Core principle

### Sign: Test After Changes
- **Trigger**: After any code change
- **Instruction**: Run tests to verify nothing broke
- **Added after**: Core principle

### Sign: Commit Checkpoints
- **Trigger**: After completing work on a criterion
- **Instruction**: Commit current working state before moving to next criterion
- **Added after**: Core principle

### Sign: Work in Current Directory
- **Trigger**: Starting any task
- **Instruction**: Do NOT run git init or scaffolding commands that create nested directories. Work in the current directory.
- **Added after**: Core principle

---

## Learned Signs

(Signs added from observed failures will appear below)

