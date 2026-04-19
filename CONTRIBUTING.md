# Contributing to SkyWalker

Thank you for wanting to make SkyWalker better. This guide covers everything from first-time setup to opening a production-ready PR.

---

## Table of Contents

1. [Ways to Contribute](#ways-to-contribute)
2. [Dev Environment Setup](#dev-environment-setup)
3. [Architecture Overview](#architecture-overview)
4. [Building a Skill (fastest way to contribute)](#building-a-skill)
5. [Adding a New Browser Action](#adding-a-new-browser-action)
6. [Adding a New LLM Provider](#adding-a-new-llm-provider)
7. [Testing Your Changes](#testing-your-changes)
8. [Commit & PR Conventions](#commit--pr-conventions)
9. [Code Style Rules](#code-style-rules)
10. [Issue Labels Explained](#issue-labels-explained)
11. [Need Help?](#need-help)

---

## Ways to Contribute

| Contribution | Effort | Impact |
|---|---|---|
| Build a new Skill | Low | High — expands what users can automate |
| Fix a bug | Low–Med | High — improves reliability |
| Improve the system prompt | Low | High — affects all tasks |
| Add a new LLM provider | Med | High — new users |
| Improve the dashboard UI | Med | Med |
| Write docs or examples | Low | Med |
| Report a bug with a trace file | Very low | High |

---

## Dev Environment Setup

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| pnpm | 9+ | `npm install -g pnpm` (Mac: `sudo npm install -g pnpm`) |
| Chromium | latest | installed via Playwright (step 4 below) |

### Steps

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/skywalker.git
cd skywalker

# 2. Install all dependencies (pnpm workspaces — installs all packages)
pnpm install

# 3. Set up environment
cp .env.example .env
# Edit .env — at minimum add ANTHROPIC_API_KEY or OPENAI_API_KEY

# 4. Install the browser
pnpm --filter @skywalker/agent exec playwright install chromium

# 5. Start both dev servers (two terminals)
pnpm --filter @skywalker/agent dev   # Agent API  → http://localhost:3001
pnpm --filter @skywalker/web dev     # Dashboard  → http://localhost:3000
```

Open `http://localhost:3000`, type a goal, and hit Launch.

### Repo layout

```
skywalker/
├── packages/
│   ├── agent/                        # Node.js agent core
│   │   └── src/
│   │       ├── agent/Agent.ts        ← See-Think-Do loop
│   │       ├── browser/
│   │       │   ├── BrowserController.ts  ← Playwright action executor
│   │       │   └── AccessibilityTree.ts  ← ariaSnapshot + DOM fallback
│   │       ├── llm/
│   │       │   ├── LLMProvider.ts    ← Abstract base + system prompt
│   │       │   ├── AnthropicProvider.ts
│   │       │   └── OpenAIProvider.ts
│   │       ├── safety/PaymentGate.ts ← Detects & pauses on payment screens
│   │       ├── skills/
│   │       │   ├── BaseSkill.ts      ← Abstract skill class
│   │       │   ├── SkillRegistry.ts  ← Auto-discovery loader
│   │       │   └── examples/        ← Reference skill implementations
│   │       ├── trace/TraceRecorder.ts
│   │       ├── types.ts             ← All Zod schemas + TypeScript types
│   │       └── server/index.ts      ← Express + Socket.io server
│   └── web/                          # Next.js 15 dashboard
│       └── src/
│           ├── app/page.tsx         ← Main dashboard page
│           ├── components/          ← UI components
│           └── hooks/               ← useAgent, useSocket
├── skills/                          ← Drop your skills here (auto-loaded)
├── traces/                          ← Saved step-by-step trace files
├── .env.example
└── turbo.json
```

---

## Architecture Overview

### The See-Think-Do Loop

Every agent step runs three phases inside `Agent.ts`:

```
SEE   → browser.screenshot() + captureAccessibilityTree(page)
THINK → llm.think({ goal, screenshot, a11yTree, previousThoughts })
DO    → browser.executeAction(llmResponse.action)
```

The LLM receives a base64 JPEG screenshot and a simplified accessibility tree, and responds with a single JSON action validated by Zod. The loop continues until the action type is `complete`, `require_human`, or `max_steps` is reached.

### Accessibility Tree

`AccessibilityTree.ts` uses three strategies in priority order:

1. **`page.locator("body").ariaSnapshot()`** — Playwright's built-in aria snapshot, pierces Shadow DOM (works on Google, LinkedIn, etc.)
2. **DOM `querySelectorAll`** — fallback for simpler sites
3. **`document.body.innerText`** — last resort so the LLM is never completely blind

The IDs assigned to nodes are injected back into the real DOM as `data-sw-id` attributes where possible, enabling `click` by element ID on non-Shadow DOM sites.

### Action Validation

Every LLM response is Zod-validated via `LLMResponseSchema` in `types.ts`. Unknown action types invented by the LLM are remapped in `AnthropicProvider.normalizeAction()`. If the JSON is malformed, `extractFirstJson()` tries to recover the first valid object.

### Socket.io Events

The agent emits typed events (`AgentEventType` in `types.ts`) for every phase. The dashboard listens to these over WebSocket. To add a new event:

1. Add the type to `AgentEventType` in `types.ts`
2. Call `this.emit_event(type, sessionId, data)` in `Agent.ts`
3. Handle it in `useAgent.ts` on the frontend

---

## Building a Skill

Skills are the easiest way to contribute. A skill is a TypeScript class that extends `BaseSkill`. Drop it in `/skills/` and it auto-loads.

### Minimal example

```typescript
// skills/NewsDigestSkill.ts
import { BaseSkill } from "@skywalker/agent/src/skills/BaseSkill.js";
import type { SkillExecuteOptions } from "@skywalker/agent/src/types.js";

export class NewsDigestSkill extends BaseSkill {
  metadata = {
    name: "news-digest",
    description: "Get a morning briefing from top news sources",
    version: "1.0.0",
    icon: "📰",
    category: "research",
    triggers: ["morning news", "news digest", "top stories"],
  };

  paramsSchema() {
    return {
      type: "object" as const,
      properties: {
        topics: {
          type: "string",
          description: "Comma-separated topics (e.g. 'tech, finance')",
        },
      },
    };
  }

  async execute({ context, params }: SkillExecuteOptions) {
    const topics = (params?.topics as string) ?? "technology, finance, world";
    context.goal = `Search for the latest news on: ${topics}. For each topic, find 2-3 headlines and key facts. Summarize everything in a morning briefing format. Use complete when done.`;
    return { success: true };
  }
}
```

### Skill requirements checklist

- [ ] Extends `BaseSkill` from the correct path
- [ ] Unique `metadata.name` in kebab-case
- [ ] At least 2 `metadata.triggers` (natural language phrases)
- [ ] `metadata.icon` (emoji), `metadata.category`, `metadata.version`
- [ ] `paramsSchema()` defined if skill takes parameters
- [ ] `validate()` overridden if params are required
- [ ] Any action that posts, purchases, or modifies data must include `require_human` in the goal string
- [ ] Tested end-to-end with `pnpm dev`

### Available skill categories

`research` · `productivity` · `ecommerce` · `social` · `travel` · `finance` · `food` · `entertainment` · `utility`

---

## Adding a New Browser Action

1. **Add the Zod schema** to `packages/agent/src/types.ts`:

```typescript
export const MyActionSchema = z.object({
  type: z.literal("my_action"),
  someParam: z.string(),
  description: z.string(),
});
```

2. **Add it to the discriminated union** in `types.ts`:

```typescript
export const AgentActionSchema = z.discriminatedUnion("type", [
  // ... existing schemas ...
  MyActionSchema,
]);
```

3. **Handle it in `BrowserController.ts`** inside the `switch` statement in `executeAction()`:

```typescript
case "my_action": {
  // Playwright logic here
  break;
}
```

4. **Document it in the system prompt** in `LLMProvider.ts` under the "Available action types" section.

5. **Add normalizer** in `AnthropicProvider.normalizeAction()` if the LLM might invent a variant name.

---

## Adding a New LLM Provider

1. Create `packages/agent/src/llm/MyProvider.ts`:

```typescript
import { LLMProvider, type LLMInput } from "./LLMProvider.js";
import type { LLMResponse } from "../types.js";
import { LLMResponseSchema } from "../types.js";

export class MyProvider extends LLMProvider {
  readonly name = "myprovider";
  readonly model: string;

  constructor(model = "my-model-id") {
    super();
    this.model = model;
  }

  async think(input: LLMInput): Promise<LLMResponse> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input);

    // Call your API here, passing input.screenshotBase64 as vision input
    const rawText = await callMyApi(systemPrompt, userPrompt, input.screenshotBase64);

    const parsed = JSON.parse(rawText) as unknown;
    return LLMResponseSchema.parse(parsed);
  }
}
```

2. Register it in `packages/agent/src/server/index.ts` where `AnthropicProvider` / `OpenAIProvider` are selected.

3. Add the env var to `.env.example` with a comment.

---

## Testing Your Changes

There are no automated tests yet (this is a great place to contribute). For now, test manually:

### Manual test checklist

Run `pnpm dev` and verify these scenarios:

| Test | Goal string to use |
|---|---|
| Basic web search | `"What is the current price of Bitcoin on CoinGecko"` |
| Form interaction | `"Search for flights from New York to London next Friday on Google Flights"` |
| Multi-step task | `"Find the top 3 trending repos on GitHub today"` |
| Error recovery | Navigate to a 404 page, see if it backtracks |
| Payment gate | Use a goal that leads to a checkout page |

**Check the trace file** in `./traces/` — each step should have a screenshot, thought, and action logged correctly.

### Build check

```bash
pnpm --filter @skywalker/agent build   # TypeScript compile check
```

---

## Commit & PR Conventions

### Commit messages

Use the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <short description>

[optional body]
```

**Types:** `feat` · `fix` · `docs` · `refactor` · `perf` · `test` · `chore`

**Examples:**
```
feat(skill): add amazon-checkout skill with payment gate
fix(browser): resolve ariaSnapshot element ID mismatch on Shadow DOM sites
docs(contributing): add LLM provider guide
perf(llm): reduce token usage by trimming a11y tree to 80 nodes
```

### PR process

1. Branch from `main`: `git checkout -b feat/my-skill`
2. Keep PRs focused — one skill or one fix per PR
3. Include a test scenario in the PR description (what goal you ran, what happened)
4. If adding a skill, include a screenshot or recording of it working
5. PRs against `main` are squash-merged

### PR title format

Same as commit messages: `feat(skill): add hotel-search skill`

---

## Code Style Rules

- **TypeScript strict mode** — no `any`, no `as unknown as X` except in `page.evaluate()` boundaries
- **No `var`** — use `const` (default) or `let`
- **No comments explaining what code does** — name things clearly; comments only for non-obvious *why* (workarounds, invariants, subtle constraints)
- **No unused imports or variables**
- **Prefer `async/await`** over `.then()` chains
- **Error messages** should include context: `"BrowserController.click: element ${elementId} not found"` not just `"not found"`
- **Zod for all external data** — anything from the LLM, from HTTP requests, or from file reads must be validated

---

## Issue Labels Explained

| Label | Meaning |
|---|---|
| `good first issue` | Self-contained, well-scoped, documented |
| `skill-request` | Request for a new skill — good contribution target |
| `bug` | Something is broken |
| `enhancement` | Improvement to existing functionality |
| `llm-reliability` | Issues with LLM parsing, prompt quality, action normalization |
| `browser` | Playwright / accessibility tree / action execution issues |
| `dashboard` | Frontend / Socket.io / UI issues |
| `help wanted` | Maintainers want outside input |

---

## Need Help?

- **Found a bug?** Open an [issue](https://github.com/skywalker-agent/skywalker/issues) with your trace file
- **Building something?** Start a [discussion](https://github.com/skywalker-agent/skywalker/discussions)
- **Direct contact:** [projects@edoborosasere.com](mailto:projects@edoborosasere.com)

---

*SkyWalker is MIT licensed. Contributions are licensed under the same terms.*
