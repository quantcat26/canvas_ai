# CanvasAI

## Core Concept

CanvasAI is an AI visual workspace platform centered on an Infinite Canvas. It recreates the freedom and flexibility of a physical whiteboard, allowing users to freely create, drag, zoom, arrange, and connect cards containing all kinds of information within an endlessly extending digital space, much like placing sticky notes.

Unlike traditional whiteboard or note-taking software, CanvasAI deeply integrates AI capabilities. Users can not only organize existing information, but also interact with AI directly on the canvas to perform chat Q&A, and content generation, creating a seamless flow between information input, processing, thinking, and output.

![demo](demo.gif)

## Live Demo

You can try out the live application here: [Live Demo Link](https://canvasai.quantcat.me/)

## Key Features

- Infinite Canvas: A borderless workspace with smooth, free zooming and panning, freeing you from fixed-size layout constraints.
- Card-Based Management: Organize text, media, links, and code into modular cards that you can freely drag, resize, group, and tag.
- AI Chatbot & Co-Creation: A built-in AI assistant for instant Q&A, context-aware suggestions, translation, and automated content generation (summaries, ideas, drafts).
- Visual Relationships: Connect cards with lines and arrows to map out logic and workflows, supported by smart alignment and layout tools.
- Multimedia Integration: Direct embedding and live previewing for videos, audio, PDFs, and web links.
- Project & Version Control: Organize work with multi-level folders and easily revert changes using automated version history.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/quantcat26/canvas_ai.git
   cd canvas_ai
   ```
2. install dependencies

   ```bash
   npm install
   ```
3. start development server

   ```bash
   npm run dev
   ```

## Environment Variables

### `AI_CONFIG_SECRET`

used to encrypt/decrypt API keys in the database. Generate one with: `openssl rand -hex 32`
