# Contributing to SkyWalker

First off — thank you for considering a contribution. SkyWalker is community-driven and every skill, fix, or doc improvement matters.

## The Easiest Way to Contribute: Build a Skill

Skills are the heart of SkyWalker's plugin system. You don't need to understand the internals — just extend `BaseSkill` and drop your file in `/skills/`.

### Step-by-step

```bash
# 1. Fork + clone
git clone https://github.com/YOUR_USERNAME/skywalker.git
cd skywalker

# 2. Install
pnpm install

# 3. Copy the template
cp packages/agent/src/skills/examples/ResearchSkill.ts skills/MySkill.ts

# 4. Edit your skill
# 5. Run dev and test it
pnpm dev

# 6. Open a PR!
```

### Skill Requirements Checklist

- [ ] Extends `BaseSkill`
- [ ] Has a unique `metadata.name` (kebab-case)
- [ ] Has `metadata.description`, `metadata.icon`, `metadata.category`
- [ ] Has at least 2 `metadata.triggers` (phrases that activate it)
- [ ] Has `paramsSchema()` if it takes parameters
- [ ] Has `validate()` checking required params
- [ ] Uses `require_human` before any destructive actions (purchases, posts, etc.)
- [ ] Has a brief comment at the top explaining what it does

## Bug Reports

Open an issue with:
1. What you expected to happen
2. What actually happened
3. Your `.env` config (without API keys)
4. The relevant trace file (from `./traces/`)

## Feature Requests

Open an issue with the `enhancement` label. Describe the use case, not the implementation.

## Code Style

- TypeScript strict mode — no `any`
- Prefer `const` over `let`
- No comments explaining *what* code does — only *why* (non-obvious invariants)
- No unused imports

## Good First Issues

Look for issues labeled [`good first issue`](https://github.com/skywalker-agent/skywalker/issues?q=label%3A%22good+first+issue%22).
