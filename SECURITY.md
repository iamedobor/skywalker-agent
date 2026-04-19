# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| `main` branch | Yes |
| Tagged releases | Latest only |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email [projects@edoborosasere.com](mailto:projects@edoborosasere.com) with:

- A description of the vulnerability
- Steps to reproduce it
- Potential impact
- (Optional) a suggested fix

You will receive a response within 48 hours. We will coordinate disclosure timing with you before publishing any fix.

## Security Notes for Operators

SkyWalker runs a real browser and executes actions based on LLM output. Keep these in mind:

- **API keys** — never commit `.env`. The `.gitignore` excludes it, but double-check before pushing.
- **`userDataDir`** — if set, the agent uses your real Chrome profile and inherits all your logged-in sessions. Only use this on a machine you control.
- **`BROWSER_HEADLESS=false`** — runs a visible browser on your display. Disable in shared environments.
- **Skill code** — skills in `/skills/` are loaded and executed automatically. Only load skills from sources you trust.
- **Payment Gate** — always reviews payment screens before proceeding, but it is not a substitute for reviewing what the agent is doing on sensitive tasks.
