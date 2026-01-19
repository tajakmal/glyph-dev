---
task: Your Task Name Here
priority: 1
depends_on: []
---

# Task: Your Task Title

## Overview

Provide a clear, detailed description of what this task accomplishes. Explain:
- What is being built or changed
- Why this task is important
- What the end result should look like

The more context you provide here, the better the AI agent will understand what to do.

## Context

Provide background information that helps the agent understand the environment:
- What existing code or systems does this interact with?
- Are there architectural patterns to follow?
- What decisions have already been made?
- Any relevant constraints or requirements?

## Success Criteria

Each criterion should be specific and verifiable. The agent will work through these in order.

1. [ ] First criterion - describe what needs to be done
2. [ ] Second criterion - be specific about expected behavior
3. [ ] Third criterion - include verification steps if helpful
4. [ ] Fourth criterion - tests pass: `uv run pytest tests/ -v`

## Technical Notes

Provide implementation guidance:
- Libraries or frameworks to use (or avoid)
- Code patterns to follow
- Edge cases to handle
- Performance considerations
- Security requirements

## Example Usage (Optional)

```bash
# Show how the completed feature should work
example-command --flag value
Expected output here
```

```python
# Or code examples
from module import function
result = function(input)
```

---

## Ralph Instructions

When working on this task:

1. Read `.ralph/guardrails.md` for signs to follow
2. Read `.ralph/progress.md` to see what's been done
3. Work on the next unchecked criterion (marked [ ])
4. After completing a criterion, change [ ] to [x] in this file
5. Update `.ralph/progress.md` with your progress
6. Commit your changes frequently with descriptive messages
7. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
8. If stuck 3+ times on same issue, output: `<ralph>GUTTER</ralph>`
