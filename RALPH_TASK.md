---
task: Global CSS Setup
priority: 1
depends_on: []
---

# Task: Global CSS Setup

Set up global CSS variables, design system tokens, and PDF text layer styles in the application.

## Overview

This task establishes the CSS foundation for the entire application. It includes design system CSS variables, the critical PDF text layer styles that enable text selection, and animation keyframes used throughout the app.

## Context

- Styles go in `src/app/globals.css`
- Using Tailwind CSS v4
- PDF text layer CSS is critical for text selection functionality
- Animations include popover entrance and search match pulsing
- Design system from PRD Section 8.1

## Requirements

### CSS Variables (Design System)

Add the following CSS variables to `:root`:

```css
:root {
  /* Background */
  --bg-primary: #09090b;
  --bg-secondary: #18181b;
  --bg-tertiary: #27272a;

  /* Text */
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #52525b;

  /* Accent */
  --accent-primary: #ef4444;
  --accent-hover: #f87171;

  /* Highlight Colors */
  --highlight-yellow: #fde047;
  --highlight-green: #86efac;
  --highlight-blue: #93c5fd;
  --highlight-pink: #f9a8d4;
  --highlight-orange: #fdba74;

  /* Border */
  --border-default: #27272a;
  --border-subtle: #3f3f46;

  /* Spacing (reference) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
}
```

### PDF Text Layer Styles

**Critical for text selection in PDFs:**

```css
.pdf-page {
  position: relative;
  margin-bottom: 16px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.pdf-canvas {
  display: block;
}

.pdf-text-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  opacity: 0.2;
  line-height: 1;
  pointer-events: auto;
}

.pdf-text-layer span {
  position: absolute;
  white-space: pre;
  color: transparent;
  pointer-events: auto;
}

.pdf-text-layer span::selection {
  background: rgba(59, 130, 246, 0.3);
}

.pdf-highlight-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.pdf-highlight-layer > div {
  pointer-events: auto;
}
```

### Animation Keyframes

```css
/* Transition defaults */
.transition-default {
  transition: all 200ms ease-in-out;
}

/* Highlight pulse on search navigation */
@keyframes highlight-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.search-match-active {
  animation: highlight-pulse 1s ease-in-out 2;
}

/* Popover appearance */
@keyframes popover-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.popover {
  animation: popover-in 150ms ease-out;
}

/* Modal appearance */
@keyframes modal-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal {
  animation: modal-in 200ms ease-out;
}

/* Fade in */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fade-in 200ms ease-out;
}

/* Spinner for loading states */
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  animation: spin 1s linear infinite;
}
```

### Scrollbar Styling

```css
/* Custom scrollbar for dark theme */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

::-webkit-scrollbar-thumb {
  background: var(--border-subtle);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
```

### Body/HTML Base Styles

```css
html, body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: system-ui, -apple-system, sans-serif;
}

/* Prevent text selection on UI elements */
.no-select {
  user-select: none;
  -webkit-user-select: none;
}

/* Allow text selection (for PDF text layer) */
.allow-select {
  user-select: text;
  -webkit-user-select: text;
}
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/app/globals.css` | Modify | Add CSS variables, text layer styles, animations |

## Success Criteria

1. [x] CSS variables for design system colors are defined in `:root`
2. [x] PDF text layer styles are implemented (`.pdf-page`, `.pdf-text-layer`, etc.)
3. [x] Text layer span selection style shows blue highlight
4. [x] Animation keyframes are defined (highlight-pulse, popover-in, modal-in, fade-in, spin)
5. [x] Utility classes are defined (transition-default, search-match-active, etc.)
6. [x] Custom scrollbar styles are implemented
7. [x] Body/HTML base styles set background and text colors
8. [x] `npm run lint` passes
9. [x] `npm run dev` runs without CSS errors

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
