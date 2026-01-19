# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Glyph is a speed reading web application built with Next.js. It displays text one word at a time using the RSVP (Rapid Serial Visual Presentation) technique with ORP (Optimal Recognition Point) highlighting.

## Commands

- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Production build
- `npm run lint` - Run ESLint
- `npm start` - Start production server

## Architecture

**Stack:** Next.js 16 with App Router, React 19, TypeScript, Tailwind CSS v4

**Structure:**
- `src/app/` - Next.js App Router pages and layouts
- `src/components/` - React components
- `@/*` path alias maps to `./src/*`

**Main Component:** `SpritzReader.tsx` is the core component containing all speed reading functionality:
- Text input (paste or file upload)
- PDF extraction via `pdfjs-dist`
- EPUB extraction via `epubjs`
- Playback controls with keyboard shortcuts (Space, Arrow keys, R)
- WPM adjustment (100-800)
- Hold-to-play mode

**Client Components:** Components using React hooks (useState, useEffect) must have `"use client"` directive at the top.
