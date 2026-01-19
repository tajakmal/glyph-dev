---
task: Shared UI Components
priority: 1
depends_on: ["001-typescript-types"]
---

# Task: Shared UI Components

Create reusable UI components (Button, Popover, Modal) that will be used throughout the application.

## Overview

These foundational UI components provide consistent styling and behavior across the application. They follow the design system defined in the PRD (Section 8.1) and use Tailwind CSS for styling. All components should be client components with proper TypeScript typing.

## Context

- Components go in `src/components/ui/`
- Use Tailwind CSS v4 for styling
- Follow the color palette from the PRD design system
- All components need `"use client"` directive
- Components should be accessible (keyboard navigation, ARIA labels)

## Requirements

### Button Component

**File:** `src/components/ui/Button.tsx`

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
```

**Variants:**
- `primary`: Red background (#ef4444), white text
- `secondary`: Zinc-800 background, zinc-100 text
- `ghost`: Transparent background, zinc-400 text, hover shows background
- `danger`: Red-600 background for destructive actions

**Sizes:**
- `sm`: h-8, px-3, text-sm
- `md`: h-10, px-4, text-base
- `lg`: h-12, px-6, text-lg

**Features:**
- Loading state with spinner
- Disabled state styling
- Icon support (left/right)
- Focus ring for accessibility

### Popover Component

**File:** `src/components/ui/Popover.tsx`

```typescript
interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
  position?: 'top' | 'bottom' | 'left' | 'right';
  offset?: number;
  children: React.ReactNode;
}
```

**Features:**
- Positioned relative to anchor element
- Auto-repositions if near viewport edge
- Click outside to close
- Escape key to close
- Animation on open/close (fade + translate)
- Arrow pointer to anchor

**Styling:**
- Background: bg-tertiary (#27272a)
- Border: border-subtle (#3f3f46)
- Shadow: elevated (lg)
- Border radius: 8px
- Padding: 8px

### Modal Component

**File:** `src/components/ui/Modal.tsx`

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  footer?: React.ReactNode;
}
```

**Features:**
- Centered overlay with backdrop
- Click backdrop to close
- Escape key to close
- Focus trap (tab stays within modal)
- Animation on open/close
- Scrollable content area

**Sizes:**
- `sm`: max-w-sm
- `md`: max-w-md
- `lg`: max-w-lg

**Styling:**
- Backdrop: black/50 opacity
- Background: bg-secondary (#18181b)
- Border radius: 12px
- Header with title and close button
- Footer area for action buttons

### Design System Colors (Reference)

```css
/* Background */
--bg-primary: #09090b;      /* zinc-950 */
--bg-secondary: #18181b;    /* zinc-900 */
--bg-tertiary: #27272a;     /* zinc-800 */

/* Text */
--text-primary: #fafafa;    /* zinc-50 */
--text-secondary: #a1a1aa;  /* zinc-400 */
--text-muted: #52525b;      /* zinc-600 */

/* Accent */
--accent-primary: #ef4444;  /* red-500 */
--accent-hover: #f87171;    /* red-400 */

/* Border */
--border-default: #27272a;  /* zinc-800 */
--border-subtle: #3f3f46;   /* zinc-700 */
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/ui/Button.tsx` | Create | Reusable button component |
| `src/components/ui/Popover.tsx` | Create | Popover/tooltip component |
| `src/components/ui/Modal.tsx` | Create | Modal dialog component |
| `src/components/ui/index.ts` | Create | Barrel export file |

## Success Criteria

1. [x] Button component exists with all variants (primary, secondary, ghost, danger)
2. [x] Button component has all sizes (sm, md, lg)
3. [x] Button supports loading state with spinner
4. [x] Popover component positions correctly relative to anchor
5. [x] Popover closes on click outside and Escape key
6. [x] Modal component renders centered with backdrop
7. [x] Modal closes on backdrop click and Escape key
8. [x] All components have TypeScript interfaces
9. [x] All components have `"use client"` directive
10. [x] `npm run type-check` passes
11. [x] `npm run lint` passes

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
