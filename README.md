<div align="center">

# ⚡ SkyWalker

### The Browser Agent with Eyes.

**Turn any natural language goal into automated browser actions.**

[![License: MIT](https://img.shields.io/badge/License-MIT-neon.svg?style=flat-square&color=00f5ff)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.47-green.svg?style=flat-square&logo=playwright)](https://playwright.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-15-white.svg?style=flat-square&logo=next.js)](https://nextjs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)
[![Stars](https://img.shields.io/github/stars/skywalker-agent/skywalker?style=flat-square&color=9d4dff)](https://github.com/skywalker-agent/skywalker/stargazers)
[![CI](https://github.com/skywalker-agent/skywalker/actions/workflows/ci.yml/badge.svg)](https://github.com/skywalker-agent/skywalker/actions/workflows/ci.yml)

<br/>

<!-- Replace with your actual demo GIF -->
![SkyWalker Demo](./docs/demo.gif)

<br/>

```
"Find the cheapest flight from NYC to London next Friday"
     ↓  SkyWalker opens Chrome, searches, reasons, clicks
"✅  Found: British Airways · $412 · 7h 05m · Departing 09:15"
```

</div>

---

## Why SkyWalker?

Traditional scrapers break the moment a website changes one CSS class.

**SkyWalker doesn't read the DOM. It reads the screen.**

Like a human, SkyWalker *sees* the current state of the browser, *thinks* about the best next action using a multimodal LLM, and *does* it — click, type, scroll, or ask you for help. If it goes down the wrong path, it backtracks. If it hits a payment screen, it stops and asks you first.

This is the **See-Think-Do** loop.

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

## ✨ Features

| Feature | Description |
|---|---|
| **👁️ Vision-First Reasoning** | Uses screenshots + accessibility trees — no brittle CSS selectors |
| **🔄 Self-Healing Loops** | Detects mistakes from new screenshots and backtracks automatically |
| **🛡️ Human-in-the-Loop Payments** | Pauses at payment screens and asks for your approval before proceeding |
| **🎬 Action Traces** | Every step saved as a `.trace.json` — replay automations without re-calling the LLM |
| **🧩 Plugin Skills** | Drop a file in `/skills` — it auto-loads into the dashboard |
| **⚡ Real-Time Dashboard** | Cyberpunk UI with live browser preview + terminal-style thinking log |
| **🔀 Multi-Provider LLM** | Switch between Claude (Anthropic) and GPT-4o (OpenAI) via one env var |
| **🔐 Session Sharing** | Use your existing Chrome profile — agent inherits your logins |

---

## 1-Minute Install

```bash
# 1. Clone
git clone https://github.com/skywalker-agent/skywalker.git
cd skywalker

# 2. Install (Mac users: sudo npm install -g pnpm if you get a permissions error)
pnpm install

# 3. Configure
cp .env.example .env
# → Open .env and add your ANTHROPIC_API_KEY (or OPENAI_API_KEY)

# 4. Install browser
pnpm --filter @skywalker/agent exec playwright install chromium

# 5. Launch (two terminals)
pnpm --filter @skywalker/agent dev   # Agent server  → http://localhost:3001
pnpm --filter @skywalker/web dev     # Dashboard     → http://localhost:3000
```

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

Skills are **Lego bricks** for SkyWalker. Each skill configures a specific goal and can have custom params rendered as a form in the dashboard.

### Build Your Own Skill

```typescript
// skills/PizzaDeliverySkill.ts
import { BaseSkill } from "@skywalker/agent";

export class PizzaDeliverySkill extends BaseSkill {
  metadata = {
    name: "pizza-delivery",
    description: "Order pizza from your favorite place",
    version: "1.0.0",
    icon: "🍕",
    category: "food",
    triggers: ["order pizza", "get pizza"],
  };

  paramsSchema() {
    return {
      type: "object",
      properties: {
        restaurant: { type: "string" },
        items: { type: "array", items: { type: "string" } },
        address: { type: "string" },
      },
      required: ["restaurant", "items", "address"],
    };
  }

  async execute({ context, params }) {
    context.goal = `Go to ${params.restaurant}'s website and add ${params.items.join(", ")} to cart. Deliver to ${params.address}. DO NOT complete payment — stop and require_human.`;
    return { success: true };
  }
}
```

**Drop `PizzaDeliverySkill.ts` into `/skills/` → it appears in the dashboard instantly. No config needed.**

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

These are the community skills we'd love to see built. Each is a great **good first issue**:

| Skill | Difficulty | Description |
|---|---|---|
| 🍕 `pizza-delivery` | Easy | Order from Domino's / Pizza Hut |
| 💼 `job-applier` | Medium | Auto-apply to LinkedIn Easy Apply jobs |
| 🏨 `hotel-search` | Easy | Find best hotel prices on Booking.com |
| 📊 `market-research` | Medium | Scrape G2/Capterra for competitor analysis |
| 🐦 `x-poster` | Easy | Post a thread on X (Twitter) |
| 🎵 `spotify-queue` | Easy | Add songs to your Spotify queue |
| 📰 `news-brief` | Easy | Morning briefing from multiple news sources |
| 🚗 `rideshare` | Hard | Book an Uber with HITL confirmation |
| 🛒 `amazon-checkout` | Hard | Purchase with PaymentGate safety |
| 📧 `email-triage` | Medium | Categorize and draft replies to emails |

**→ [See all open issues](https://github.com/skywalker-agent/skywalker/issues?q=label%3A%22good+first+issue%22)**

---

## 🤝 Contributing

SkyWalker is built by developers, for developers. Read the full guide in [CONTRIBUTING.md](CONTRIBUTING.md).

The quickest contribution is building a **Skill** — one file, no internals knowledge needed:

```bash
# 1. Fork + clone
# 2. Copy the template
cp packages/agent/src/skills/examples/ResearchSkill.ts skills/MyAwesomeSkill.ts
# 3. Edit it, run pnpm dev, test it
# 4. Open a PR
```

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
