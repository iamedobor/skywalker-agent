---
name: SkyWalker Project
description: Open-source viral GitHub project — AI browser agent with See-Think-Do loop, Skill plugin system, and cyberpunk Next.js dashboard
type: project
---

SkyWalker is a full-stack open-source AI browser agent targeting viral GitHub traction.

**Why:** Build a compelling, production-quality open-source project to attract GitHub stars, contributors, and community.

**Architecture:**
- Monorepo: pnpm workspaces + Turborepo
- `packages/agent/` — TypeScript agent core (Playwright, Express, Socket.io)
- `packages/web/` — Next.js 15 dashboard (Tailwind, cyberpunk theme, Framer Motion)
- `skills/` — user-contributed skill plugins (auto-discovered)

**Key design decisions:**
- See-Think-Do loop in `Agent.ts` — screenshot + a11y tree → LLM → action
- Zod-validated LLM outputs (no JSON parsing bugs)
- PaymentGate pauses agent at payment screens, emits Socket.io event, waits for human approval
- SkillRegistry auto-discovers any .ts/.js file exported from BaseSkill
- TraceRecorder saves every step — replay without re-calling LLM
- LLM abstraction: swap Anthropic ↔ OpenAI via env var

**How to apply:** When extending or refining SkyWalker, preserve the modular skill plugin pattern. The viral hook is the 1-minute install + plug-and-play skill system.
