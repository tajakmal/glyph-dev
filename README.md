# Glyph

> **Read fast, read slow.**
> A reading companion that turns any document into an attention system — not just a faster scroll.

Glyph is a speed-reading and goal-based reading app built for people who want to get *through* their reading list without getting *past* what they read. Upload a PDF, paste an article, or point it at an EPUB, and Glyph gives you two ways in: a classic RSVP (Rapid Serial Visual Presentation) engine for blazing through prose, and an AI-driven "goal read" mode that chunks a document, primes your attention, and quizzes you after each chunk.

It's a personal library, a focus timer, a tutor, and a chat-with-your-document tool — all in one quiet, monospace-flavored interface.

---

## Why Glyph?

Most reading apps optimize for one thing: either speed (RSVP tools) or comprehension (annotation tools). Glyph assumes you want both, and lets you shift between them mid-document without losing your place.

- **Speed-read** a dense chapter to find the interesting parts.
- **Switch** to the full PDF/text view to highlight, bookmark, and re-read slowly.
- **Start a goal** — "give me the key arguments from pages 40–80" — and Glyph generates a primer, splits the range into chunks, and quizzes you after each one.
- **Chat** with any document using your own Anthropic API key, with quotes you select automatically piped into the conversation.

Everything is stored locally in your browser. There's no login, no account, no cloud by default — just your library on your device.

---

## Features

### The reader

- **Unified reader layout** — every document opens into one layout that can render as a native PDF, a clean text view, or the RSVP speed-read panel. Switching modes preserves your scroll position and word index, so you never lose your place.
- **PDF support** with `pdfjs-dist`: page virtualization, pinch/keyboard zoom, text selection mapped to global word indices, search, outline/TOC, and a dock with quick-jump controls.
- **EPUB import** via `epubjs` — chapters are flattened into a single readable stream.
- **Text/paste import** — drop in an article, a transcript, a spec; Glyph tokenizes it and treats it like any other document.
- **Selection action bar** — highlight a passage to bookmark it, start a focused goal on just that selection, or send it into chat as a quote.

### Speed-read (RSVP)

- **ORP highlighting** — each word is rendered with its Optimal Recognition Point colored, so your eye locks onto a fixed focal point instead of scanning left-to-right.
- **100–800 WPM** with a default you can set in Settings.
- **Two display modes** — `single` (one word at a time) and `ghost` (with faint previous/next context).
- **Context strip** — a ribbon of surrounding words above the focal word for sentence-level grounding.
- **Doc mini-map** — a tiny progress bar showing where you are in the full document, with chapter/chunk markers.
- **Keyboard shortcuts** — `Space` play/pause, `←/→` step word-by-word, `↑/↓` adjust WPM, `R` restart, hold-to-play.
- **Hold-to-play mode** — press and hold anywhere to advance, release to pause. Great on mobile.
- **Session guardrails** — short sessions (<50 words or <5s) don't pollute your reading stats.
- **Bookmark-at-word** — drop a bookmark on the exact word you're looking at, then jump back to it later in the full text view.

### Goal-based reading (AI-assisted)

Pick a range — a selection, a page span, or "the next N minutes of reading" — and Glyph builds a structured reading plan around it:

1. **Primer** — a short summary of what the range covers plus a handful of open-ended *attention anchors* (questions to hold in your head while reading).
2. **Chunked reading** — the range is split into ~5–10 chunks sized to your pace. Each chunk gets its own mini-primer.
3. **Inline quiz** — after each chunk, a multi-choice quiz with 3–4 questions. Answer correctly and move on; miss one and Glyph opens a `SourceModal` that jumps you to the exact passage the question came from.
4. **Between-chunks screen** — a breather with score feedback before the next chunk.
5. **Final summary** — an overview of what you covered and how you did.

Powered by `claude-sonnet-4-6` via the Anthropic SDK. Goals up to 5,000 words; shorter selections auto-route to plain speed-read.

### Marks (highlights, bookmarks, notes)

- **Unified Marks screen** — a single timeline of every highlight, bookmark, and note across every document, filterable by type.
- **Jump-back** — tap any mark to open the source document at that page or word index.
- **Highlights with color** and optional notes, stored per-document.

### Chat with your document

- **Bring-your-own-key** (Anthropic) or subscription provider abstraction — pluggable via `src/lib/chat/`.
- **Quote-to-chat** — select a passage in the reader, hit "Ask" in the action bar, and the quote is pre-loaded into the chat composer.
- **Full-document context** — the doc is injected as context so answers are grounded in what you're actually reading.
- **Streaming responses** with abort support.

### Library & home

- **Continue where you left off** — the home page surfaces the doc you were most recently reading, with a progress bar.
- **Shelf** — a 2-column grid of your library, sorted by recency, with a collapsible "all" view.
- **Per-card menu** — jump straight into speed-read mode or delete a document.
- **Recent imports** on the New screen so you can spot duplicates before re-uploading.

### Shell & polish

- **Dark / Paper / Auto** themes — paper mode is a warm, low-contrast light theme tuned for long reading sessions.
- **Bottom tab bar** — Home · New · Marks · Settings, with a mobile-first layout that also works great on desktop.
- **Monospace micro-labels** and a quiet accent color throughout — the UI stays out of the way of the text.
- **Error boundary** and skeleton loading states so the app degrades gracefully.
- **Feature flags** — toggle experimental features via `localStorage` or `NEXT_PUBLIC_FLAG_*` env vars (see [`src/lib/feature-flags.ts`](src/lib/feature-flags.ts)).

---

## Getting started

### Requirements

- Node.js 20+
- An Anthropic API key (only required for Chat and Goal-based Reading)

### Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

A `postinstall` step copies the `pdfjs-dist` worker and cmaps into `public/` so PDF rendering works out of the box.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript, no emit |

### Configuring the AI features

Open **Settings** in the app and paste an Anthropic API key. The key is stored in `localStorage` on your device and used for:

- Goal-based reading (primer, quiz, summary generation)
- Chat with document

Without a key the rest of the app — library, speed-read, highlights, marks — works fully.

---

## How to use it

### Add something to read

From the home screen, tap **New** and either:

- **Upload a PDF** — drag-drop or file picker.
- **Paste text** — give it a title, paste the body, save.
- **Scan / Link** — coming soon (see Roadmap).

### Speed-read a document

Open a document from your Shelf and tap the ⚡ icon (or use the card menu). The RSVP engine starts at your default WPM.

- `Space` — play/pause
- `←` / `→` — step back/forward one word
- `↑` / `↓` — increase/decrease WPM
- `R` — restart
- Tap-hold — play while held
- Double-tap — toggle ghost mode

### Start a goal

Inside a document, highlight a passage *or* open the goal chooser and pick "Next N minutes" (3 / 5 / 10 / 15). Glyph generates a primer, you read each chunk in the RSVP engine or the text view, and the quiz modal pops up at each chunk boundary. Wrong answer? A `SourceModal` shows the exact passage the question came from.

### Collect marks

Highlight text anywhere in the reader to save a highlight (with optional note). Drop a bookmark on a specific word during speed-read. Everything lands in the **Marks** tab, filterable by kind and searchable across your whole library.

### Chat with a document

Open a document, tap the chat icon, and ask anything. Select text first to quote it directly into the conversation.

---

## Architecture

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Anthropic SDK · pdfjs-dist · epubjs

```
src/
  app/                    Next.js routes (App Router)
    api/v1/               Documents, highlights, speed-read analyze, sync batch
    reader/[id]/          Unified document reader
    speed-read/           Standalone RSVP entry
    new/ marks/ settings/
  components/
    reader/               UnifiedReaderLayout (the orchestrator)
    pdf/                  PDFViewer + virtualized pages, text layer, highlights, search, outline
    text/                 TextReader, selection action bar
    speed-read/           SpeedReadPanel, ORPWord, ContextStrip, DocMiniMap
    goal-read/            PrimerModal, QuizModal, BetweenChunksScreen, FinalSummaryScreen, SourceModal
    chat/                 ChatPanel + useChat
    library/ marks/ new/ settings/ shell/ ui/
  contexts/               ReaderContext, GoalContext
  hooks/                  useSpeedReader, useGoalSession, useGoalGeneration, usePDF, useHighlights, …
  lib/
    goal-read/            chunking, prompt, provider, snap, types
    chat/                 BYOK + subscription providers
    speed-read.ts  tokenize.ts  storage.ts  feature-flags.ts  telemetry.ts
  types/
```

**Key design choices:**

- **All document state flows through `ReaderContext`** — the current word index, view mode, WPM, and document meta live in one place so PDF, text, and speed-read views stay in sync.
- **`GoalContext` wraps `ReaderContext`** — goal sessions are a layer on top of normal reading, not a separate mode.
- **Word indices are global** — the tokenizer produces a single index space per document, so a selection in the PDF maps cleanly to a word in the RSVP engine and back.
- **Local-first** — documents, highlights, bookmarks, and preferences are stored in `localStorage` / IndexedDB. A sync layer exists under `src/lib/sync/` and `src/app/api/v1/sync/` for a future cloud sync.

---

## Roadmap

Things in the code today as scaffolding, or planned:

- **Scan** — mobile camera capture of physical pages, OCR into a text document.
- **Link import** — paste a URL, extract readable content, import it.
- **Cloud sync** — opt-in sync of library, highlights, and reading progress across devices (API routes and queue are stubbed under `src/lib/sync/`).
- **Auth** — optional account layer (`auth_required` feature flag exists).
- **Richer goal types** — "summarize for me", "find all mentions of X", "read until you hit a decision point".
- **Subscription chat provider** — a hosted option so users don't have to bring their own key.
- **Multi-doc goals** — a single goal that spans several documents on your shelf.
- **Better EPUB rendering** — per-chapter navigation, images, footnotes.
- **Reading stats** — streaks, WPM trend, words-read-per-week.

---

## Credits

- **RSVP / ORP** technique popularized by Spritz.
- **PDF rendering** by [pdf.js](https://mozilla.github.io/pdf.js/).
- **EPUB parsing** by [epub.js](https://github.com/futurepress/epub.js).
- **AI features** powered by the [Anthropic API](https://docs.anthropic.com/).
- Built on [Next.js](https://nextjs.org) and [React](https://react.dev).
