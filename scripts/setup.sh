#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
cat << 'BANNER'
╔═══════════════════════════════════════════╗
║            ⚡ SkyWalker Setup             ║
║    Browser agent that sees and acts.      ║
╚═══════════════════════════════════════════╝
BANNER
echo -e "${NC}"

# ── Node.js ──────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js not found. Install Node.js 20+ from https://nodejs.org${NC}"
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_VER" -lt 20 ]; then
  echo -e "${RED}✗ Node.js 20+ required (you have $(node -v))${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# ── pnpm ─────────────────────────────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  echo -e "${YELLOW}→ pnpm not found — installing...${NC}"
  npm install -g pnpm
fi
echo -e "${GREEN}✓ pnpm $(pnpm -v)${NC}"

# ── Dependencies ─────────────────────────────────────────────────────────────
echo -e "\n${CYAN}→ Installing dependencies...${NC}"
pnpm install

# ── Playwright browser ───────────────────────────────────────────────────────
echo -e "\n${CYAN}→ Installing Playwright browser (chromium)...${NC}"
pnpm --filter @skywalker/agent exec playwright install chromium

# ── .env setup ───────────────────────────────────────────────────────────────
if [ -f .env ]; then
  echo -e "\n${YELLOW}→ .env already exists — skipping configuration.${NC}"
  echo -e "   To reconfigure, delete .env and re-run this script."
else
  echo -e "\n${CYAN}${BOLD}→ LLM Provider Setup${NC}"
  echo ""
  echo "  Which provider do you want to use?"
  echo "  1) Anthropic Claude  (recommended — best vision reasoning)"
  echo "  2) OpenAI GPT-4o"
  echo ""
  read -rp "  Choice [1]: " PROVIDER_CHOICE
  PROVIDER_CHOICE=${PROVIDER_CHOICE:-1}

  if [ "$PROVIDER_CHOICE" = "2" ]; then
    LLM_PROVIDER="openai"
    LLM_MODEL="gpt-4o"
    echo ""
    read -rp "  OpenAI API key (sk-...): " API_KEY
    ANTHROPIC_KEY=""
    OPENAI_KEY="$API_KEY"
  else
    LLM_PROVIDER="anthropic"
    LLM_MODEL="claude-haiku-4-5-20251001"
    echo ""
    read -rp "  Anthropic API key (sk-ant-...): " API_KEY
    ANTHROPIC_KEY="$API_KEY"
    OPENAI_KEY=""
  fi

  cat > .env << ENVEOF
# ─── LLM Provider ─────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=${ANTHROPIC_KEY}
OPENAI_API_KEY=${OPENAI_KEY}
LLM_PROVIDER=${LLM_PROVIDER}
LLM_MODEL=${LLM_MODEL}

# ─── Agent Server ─────────────────────────────────────────────────────────────
PORT=3001
AGENT_TIMEOUT_MS=120000
MAX_STEPS=75

# ─── Browser ──────────────────────────────────────────────────────────────────
BROWSER_TYPE=chromium
BROWSER_HEADLESS=true

# ─── Frontend ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_AGENT_URL=http://localhost:3001
ENVEOF

  echo -e "\n${GREEN}✓ .env created${NC}"
fi

# ── Launch ───────────────────────────────────────────────────────────────────
echo -e "\n${GREEN}${BOLD}✓ Setup complete!${NC}\n"
echo -e "  Dashboard  →  ${BOLD}http://localhost:3000${NC}"
echo -e "  Agent API  →  ${BOLD}http://localhost:3001${NC}"
echo ""
echo -e "${CYAN}→ Starting SkyWalker...${NC}\n"
pnpm dev
