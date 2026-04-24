<div align="center">

# ⚡ SkyWalker

### The Browser Agent with Eyes.

**Turn any natural language goal into automated browser actions.**

[![License: MIT](https://img.shields.io/badge/License-MIT-neon.svg?style=flat-square&color=00f5ff)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.47-green.svg?style=flat-square&logo=playwright)](https://playwright.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-15-white.svg?style=flat-square&logo=next.js)](https://nextjs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)
[![Stars](https://img.shields.io/github/stars/iamedobor/skywalker-agent?style=flat-square&color=9d4dff)](https://github.com/iamedobor/skywalker-agent/stargazers)
[![CI](https://github.com/iamedobor/skywalker-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/iamedobor/skywalker-agent/actions/workflows/ci.yml)

<br/>

<!-- Replace with your actual demo GIF -->
![SkyWalker Demo](./docs/demo.gif)

<br/>

```
Click "flight-search"  →  NYC → London, depart 2026-05-01
     ↓  SkyWalker opens Chrome, lands on a pre-filled results page, reads the screen
"✅  Cheapest: British Airways · $412 · 7h 05m · Departing 09:15"
```

</div>

---

## Why SkyWalker?

Traditional scrapers break the moment a website changes one CSS class. Pure-vision agents burn 75 steps fighting date pickers.

**SkyWalker does both — and knows when to cheat.**

- For unknown sites, it runs a **See-Think-Do** vision loop: screenshot → multimodal LLM → action. It backtracks when wrong, and pauses at payment screens.
- For known sites, it ships **Skills** — tiny TypeScript plugins that build a deep-link URL with the query pre-filled so the agent lands on a results page and only has to *read*. No date-picker wars. No autocomplete battles.

Every skill lives in one file. Drop it in `/skills/` — it shows up as a form in the dashboard instantly.

```
┌─────────────────────────────────────────────────────┐
│                    SkyWalker Loop                    │
│                                                      │
│   SEE           THINK              DO                │
│   ─────   →    ──────────    →    ──────             │
│ Screenshot   Multimodal LLM    Click / Type          │
│  + A11y     reasons about      / Scroll /            │
│   Tree        the UI goal      Navigate              │
│                                                      │
│           ← Repeat until COMPLETE or HUMAN ←        │
└─────────────────────────────────────────────────────┘
```

---

## What Works Today

SkyWalker ships with three battle-tested skills that work reliably on a cold install:

| Skill | What it does | Why it's bulletproof |
|---|---|---|
| ✈️ **`flight-search`** | Finds the cheapest flight between two cities on a date | Deep-links into Google Flights' `?q=` natural-language endpoint — skips the date picker entirely |
| 🔍 **`research`** | Deep-dives any topic across 1–5 sources | Lands on a Google search URL and reads — where vision LLMs are strongest |
| 💼 **`linkedin`** | Search profiles, extract leads, or send connection requests (with approval) | Uses LinkedIn's `/search/results/` URL shape; connection sends gate through `require_human` |

Type a free-form goal in the command bar if you want raw vision-loop mode.

---

## ✨ Features

| Feature | Description |
|---|---|
| **🧩 Skill Plugins** | One file, `plan(params) → { goal, startUrl }`. Drop in `/skills/` — appears in the dashboard with an auto-generated params form |
| **👁️ Vision-First Reasoning** | Screenshots + accessibility trees — no brittle CSS selectors |
| **🔄 Self-Healing Loops** | Detects repeat-action loops via action fingerprinting and injects a corrective hint |
| **🛡️ Human-in-the-Loop Payments** | Pauses at payment screens and asks for your approval before proceeding |
| **🎬 Action Traces** | Every step saved as a `.trace.json` — replay without re-calling the LLM |
| **⚡ Real-Time Dashboard** | Cyberpunk UI with live browser preview + terminal-style thinking log |
| **🔀 Multi-Provider LLM** | Switch between Claude (Anthropic) and GPT-4o (OpenAI) via one env var |
| **🔐 Session Sharing** | Point at your existing Chrome profile — agent inherits your logins |
| **🖥️ Cross-Platform Input** | Uses Playwright's `ControlOrMeta` modifier so `select-all` works on macOS, Windows, and Linux |

---

## 1-Minute Install

```bash
git clone https://github.com/iamedobor/skywalker-agent.git
cd skywalker-agent
./scripts/setup.sh
```

The setup script handles everything: checks Node.js, installs pnpm if needed, installs dependencies, installs the Playwright browser, prompts you for your API key, writes your `.env`, and launches both services.

When it's done, open **http://localhost:3000**.

> **Watch mode:** Set `BROWSER_HEADLESS=false` in `.env` to watch SkyWalker work in real time. It's mesmerizing.

> **Speed Tip:** SkyWalker supports two modes. Set `LLM_MODEL` in your `.env` to match your task:

| Model | Speed | Best for |
|---|---|---|
| `claude-haiku-4-5-20251001` | ⚡ Fast (~30s) | Price lookups, research, simple reads |
| `claude-sonnet-4-6` *(default)* | 🧠 Thorough (~2min) | Booking flows, form filling, complex tasks |
| `gpt-4o` | ⚡ Fast | OpenAI alternative |

---

## How It Works

### The See-Think-Do Loop

```typescript
// Every step follows this exact pattern
for (let step = 1; step <= maxSteps; step++) {

  // ── SEE ─────────────────────────────────────────────
  const screenshot = await browser.screenshot();           // Base64 JPEG
  const a11yTree   = await captureAccessibilityTree(page); // Simplified tree

  // ── THINK ────────────────────────────────────────────
  const { thought, action } = await llm.think({
    goal, screenshot, a11yTree, previousThoughts
  });

  // ── DO ───────────────────────────────────────────────
  await browser.executeAction(action);
  recorder.recordStep({ screenshot, thought, action });

  if (action.type === "complete") return action.result;
  if (action.type === "backtrack") rewindToSafeState();
  if (action.type === "require_human") await waitForApproval();
}
```

### The Payment Gate

When SkyWalker detects words like "Pay Now", "Confirm Purchase", or CVV fields, it **automatically pauses** and sends a notification to the dashboard with a screenshot of the page. You see exactly what it sees, then click **Approve** or **Cancel**.

```
                    ┌─────────────────────────┐
  Agent running...  │   💳 Payment Gate       │
  → Navigating...   │                         │
  → Searching...    │  Found: BA Flight $412  │
  → Selecting...    │  [Screenshot of page]   │
  ────── PAUSE ───► │                         │
                    │  [Approve ✓]  [Cancel ✗]│
                    └─────────────────────────┘
```

---

## 🧩 The Skill System

Skills are **Lego bricks** for SkyWalker. Each skill returns a `SkillPlan` — a goal string plus an optional deep-link URL — and gets a params form auto-rendered from its JSON Schema.

### The `plan()` pattern

```typescript
// skills/HotelSearchSkill.ts
import { BaseSkill, type SkillPlan } from "@skywalker/agent/src/skills/BaseSkill.js";

export class HotelSearchSkill extends BaseSkill {
  readonly metadata = {
    name: "hotel-search",
    description: "Find hotel deals on Booking.com",
    version: "1.0.0",
    author: "Your Name",
    icon: "🏨",
    category: "travel",
    triggers: ["find hotel", "book hotel", "hotel deals"],
  };

  paramsSchema(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        city:     { type: "string", description: "Destination city" },
        checkIn:  { type: "string", format: "date" },
        checkOut: { type: "string", format: "date" },
        guests:   { type: "integer", minimum: 1, maximum: 10, default: 2 },
      },
      required: ["city", "checkIn", "checkOut"],
    };
  }

  plan(params?: Record<string, unknown>): SkillPlan {
    const city = encodeURIComponent(String(params?.city));
    const checkIn = String(params?.checkIn);
    const checkOut = String(params?.checkOut);
    const guests = Number(params?.guests ?? 2);

    return {
      startUrl:
        `https://www.booking.com/searchresults.html` +
        `?ss=${city}&checkin=${checkIn}&checkout=${checkOut}&group_adults=${guests}`,
      goal: [
        `You are on Booking.com results for ${city} (${checkIn} → ${checkOut}, ${guests} guests).`,
        `The search is already configured — do NOT re-enter dates.`,
        `Read the top 5 hotels: name, price/night, rating, and one highlight. Return via "complete".`,
      ].join(" "),
    };
  }
}
```

**Drop `HotelSearchSkill.ts` into `/skills/` → it appears in the dashboard instantly with a form. No frontend work. No config.**

> 💡 **The trick**: build a deep-link URL with every param pre-filled, land the agent on a results page, and let it focus on what vision LLMs do best — reading structured information off a screen.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Browser Control** | [Playwright](https://playwright.dev/) 1.47 |
| **Agent Core** | TypeScript 5.4, Node.js 20+ |
| **LLM Providers** | Anthropic Claude (vision) · OpenAI GPT-4o |
| **Action Validation** | [Zod](https://zod.dev/) — every LLM output is schema-validated |
| **Real-Time** | [Socket.io](https://socket.io/) — live thought streaming |
| **Dashboard** | [Next.js 15](https://nextjs.org/) + [Tailwind CSS](https://tailwindcss.com/) |
| **Monorepo** | [pnpm](https://pnpm.io/) + [Turborepo](https://turbo.build/) |

---

## 📁 Project Structure

```
skywalker/
├── packages/
│   ├── agent/                  # Core agent (Node.js + Playwright)
│   │   └── src/
│   │       ├── agent/Agent.ts  # ⭐ See-Think-Do loop
│   │       ├── llm/            # Anthropic & OpenAI providers
│   │       ├── skills/         # BaseSkill + auto-discovery
│   │       ├── safety/         # PaymentGate
│   │       ├── trace/          # TraceRecorder + TracePlayer
│   │       └── server/         # Express + Socket.io
│   └── web/                    # Next.js 15 dashboard
│       └── src/
│           ├── app/page.tsx    # ⭐ Main dashboard
│           ├── components/     # CommandBar, BrowserPreview, ThinkingLog...
│           └── hooks/          # useAgent, useSocket
├── skills/                     # 📦 Drop your skills here!
├── traces/                     # Saved trace files (auto-created)
├── .env.example
└── README.md
```

---

## 🌟 Most Wanted Skills

These are community skills we'd love to see built. Each is a great **good first issue**. For most of them, the only real work is finding the right deep-link URL shape:

| Skill | Difficulty | Hint |
|---|---|---|
| 🏨 `hotel-search` | Easy | `booking.com/searchresults.html?ss=<city>&checkin=<date>&checkout=<date>` |
| 📰 `news-digest` | Easy | `news.google.com/search?q=<topics>` |
| 📊 `product-research` | Easy | `amazon.com/s?k=<query>` — extract top 5 with prices |
| 🐦 `x-search` | Easy | `x.com/search?q=<query>&f=live` — cookie-gated, needs session sharing |
| 📅 `calendar-check` | Medium | Works on your Chrome profile via `BROWSER_USER_DATA_DIR` |
| 🐙 `github-trending` | Easy | `github.com/trending?since=daily&language=<lang>` |
| 🛒 `amazon-checkout` | Hard | Uses PaymentGate + `require_human` — safety pattern reference |
| 📧 `email-triage` | Medium | Works on Gmail with user-data-dir session |
| 🎵 `spotify-queue` | Medium | Web player + session sharing |
| 🚗 `rideshare` | Hard | Uber/Lyft with HITL confirmation on pickup |

**→ [See all open issues](https://github.com/iamedobor/skywalker-agent/issues?q=label%3A%22good+first+issue%22)**

---

## 🤝 Contributing

SkyWalker is built by developers, for developers. Read the full guide in [CONTRIBUTING.md](CONTRIBUTING.md).

The quickest contribution is building a **Skill** — one file, no internals knowledge needed:

```bash
# 1. Fork + clone
# 2. Copy a reference skill (pick the closest domain)
cp packages/agent/src/skills/examples/ResearchSkill.ts skills/MyAwesomeSkill.ts
# 3. Edit metadata + paramsSchema() + plan(). Run pnpm dev. Test it end-to-end.
# 4. Open a PR — include a screenshot of it running in the dashboard
```

**What makes a PR merge fast**: deep-link URL that pre-fills the search, JSON Schema with sensible defaults, and a trace file attached to the PR description showing it worked.

Also see: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · [SECURITY.md](SECURITY.md)

---

## 📋 Roadmap

- [ ] **v0.2** — Firefox & WebKit support
- [ ] **v0.2** — Trace replay in the dashboard UI
- [ ] **v0.3** — Multi-tab support (parallel browser sessions)
- [ ] **v0.3** — Skill marketplace (community registry)
- [ ] **v0.4** — `npx skywalker` one-liner CLI
- [ ] **v0.5** — AP2 / x402 agentic payment protocol integration

---

## License

MIT — build whatever you want. ⚡

---

<div align="center">

**If SkyWalker saved you time, please give it a ⭐ — it helps more people find it.**

---

### Built by

**Osasere Edobor**

[🌐 Website](https://edoborosasere.com) · [💼 LinkedIn](https://www.linkedin.com/in/osasere-edobor) · [🐦 Twitter](https://twitter.com/sere_edobor) · [📸 Instagram](https://www.instagram.com/sere_edobor) · [📘 Facebook](https://www.facebook.com/edobor.osasere1) · [📧 projects@edoborosasere.com](mailto:projects@edoborosasere.com)

Open to collabs, contributors, and ideas. Slide in. 🚀

Made with 🤖 by Osasere Edobor

</div>
