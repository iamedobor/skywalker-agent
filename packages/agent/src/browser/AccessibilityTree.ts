import type { Page } from "playwright";
import type { AccessibilityNode } from "../types.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Capture accessibility tree using Playwright's ariaSnapshot (primary)
 * which correctly pierces Shadow DOM used by Google Flights, LinkedIn, etc.
 * Falls back to DOM evaluation for sites where ariaSnapshot is unavailable.
 */
export async function captureAccessibilityTree(
  page: Page
): Promise<AccessibilityNode[]> {
  // Primary: Playwright's internal aria snapshot — pierces Shadow DOM
  try {
    const yaml = await page.locator("body").ariaSnapshot({ timeout: 4000 });
    const nodes = parseAriaYaml(yaml);
    if (nodes.length >= 3) {
      const nodesWithIds = nodes.slice(0, 100).map((n) => ({ ...n, id: uuidv4().slice(0, 8) }));
      // Inject data-sw-id into DOM so click-by-elementId works on non-Shadow DOM sites
      try {
        await page.evaluate((nodeData: Array<{id: string; role: string; name: string}>) => {
          const roleToSelector: Record<string, string> = {
            button: 'button, [role="button"]',
            link: 'a[href], [role="link"]',
            textbox: 'input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, [role="textbox"]',
            combobox: 'select, [role="combobox"]',
            checkbox: 'input[type=checkbox], [role="checkbox"]',
            radio: 'input[type=radio], [role="radio"]',
            tab: '[role="tab"]',
            menuitem: '[role="menuitem"]',
            searchbox: 'input[type=search], [role="searchbox"]',
          };
          for (const { id, role, name } of nodeData) {
            if (!name) continue;
            const sel = roleToSelector[role] ?? `[role="${role}"]`;
            const els = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
            for (const el of els) {
              if (el.getAttribute("data-sw-id")) continue;
              const elText = (
                el.getAttribute("aria-label") ??
                el.getAttribute("placeholder") ??
                el.textContent ??
                ""
              ).trim().slice(0, 80);
              const nameLower = name.toLowerCase();
              const elLower = elText.toLowerCase();
              if (elLower === nameLower || elLower.includes(nameLower) || nameLower.includes(elLower)) {
                el.setAttribute("data-sw-id", id);
                break;
              }
            }
          }
        }, nodesWithIds.map((n) => ({ id: n.id, role: n.role, name: n.name })));
      } catch {
        // Shadow DOM sites can't be injected — click_text will handle them
      }
      return nodesWithIds;
    }
  } catch {
    // fall through to DOM fallback
  }

  // Fallback: DOM evaluation for simpler sites
  try {
    const nodes = await page.evaluate(() => {
      const results: Array<{
        role: string;
        name: string;
        value?: string;
        placeholder?: string;
        disabled?: boolean;
      }> = [];

      const SELECTORS = [
        "a[href]", "button", "input:not([type=hidden])", "select", "textarea",
        "[role=button]", "[role=link]", "[role=textbox]", "[role=combobox]",
        "[role=option]", "[role=menuitem]", "[role=tab]", "[aria-haspopup]",
        "h1", "h2", "h3",
      ].join(",");

      const seen = new Set<Element>();
      document.querySelectorAll(SELECTORS).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);

        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return;

        const role =
          el.getAttribute("role") ??
          ({ a: "link", button: "button", input: "textbox", select: "combobox", textarea: "textbox", h1: "heading", h2: "heading", h3: "heading" } as Record<string, string>)[el.tagName.toLowerCase()] ??
          el.tagName.toLowerCase();

        const name =
          el.getAttribute("aria-label") ??
          el.getAttribute("title") ??
          el.getAttribute("alt") ??
          el.getAttribute("placeholder") ??
          (el as HTMLElement).innerText?.trim().slice(0, 80) ??
          "";

        if (!name && role === el.tagName.toLowerCase()) return;

        results.push({
          role,
          name: name || `<${el.tagName.toLowerCase()}>`,
          value: (el as HTMLInputElement).value || undefined,
          placeholder: el.getAttribute("placeholder") || undefined,
          disabled: (el as HTMLButtonElement).disabled || false,
        });
      });

      return results.slice(0, 100);
    });

    if (nodes.length > 0) {
      return nodes.map((n) => ({ ...n, id: uuidv4().slice(0, 8) }));
    }
  } catch {
    // fall through to text extraction
  }

  // Last resort: extract visible page text so LLM isn't completely blind
  try {
    const text = await page.evaluate(() =>
      document.body?.innerText?.replace(/\s+/g, " ").trim().slice(0, 4000) ?? ""
    );
    if (text) {
      return [{
        id: uuidv4().slice(0, 8),
        role: "document",
        name: `VISIBLE PAGE TEXT: ${text}`,
      }];
    }
  } catch {
    // ignore
  }

  return [];
}

/**
 * Parse Playwright's YAML aria snapshot into AccessibilityNode list.
 * Format example:
 *   - button "Accept all"
 *   - textbox "Search" [focused]
 *   - link "Home" [url="https://..."]
 */
function parseAriaYaml(yaml: string): Omit<AccessibilityNode, "id">[] {
  const nodes: Omit<AccessibilityNode, "id">[] = [];

  for (const line of yaml.split("\n")) {
    // Match: optional indent, dash, role, optional quoted name
    const match = line.match(/^\s*-\s+(\w[\w-]*)\s*(?:"([^"]*)")?(.*)$/);
    if (!match) continue;

    const [, role, name = ""] = match;
    if (!role || role === "generic" || role === "none") continue;

    // Skip pure container roles with no name
    if (!name && ["group", "region", "main", "navigation", "list"].includes(role)) continue;

    const extra = match[3] ?? "";
    const disabled = extra.includes("[disabled]");
    const checked = extra.includes("[checked]")
      ? true
      : extra.includes("[unchecked]")
        ? false
        : undefined;

    nodes.push({ role, name, disabled, checked });
  }

  return nodes;
}

export function serializeTreeToPrompt(nodes: AccessibilityNode[]): string {
  if (nodes.length === 0) return "(no elements found)";
  const lines = ["Interactive elements on this page:"];
  for (const node of nodes) {
    let line = `[${node.id}] <${node.role}>`;
    if (node.name) line += ` "${node.name}"`;
    if (node.value) line += ` value="${node.value}"`;
    if (node.checked !== undefined) line += ` checked=${node.checked}`;
    if (node.disabled) line += ` (disabled)`;
    lines.push(line);
  }
  return lines.join("\n");
}
