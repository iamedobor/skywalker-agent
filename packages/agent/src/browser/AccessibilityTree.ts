import type { Page } from "playwright";
import type { AccessibilityNode } from "../types.js";
import { v4 as uuidv4 } from "uuid";

export async function captureAccessibilityTree(
  page: Page
): Promise<AccessibilityNode[]> {
  try {
    const nodes = await page.evaluate(() => {
      const results: Array<{
        role: string;
        name: string;
        value?: string;
        placeholder?: string;
        disabled?: boolean;
        checked?: boolean;
        tag?: string;
      }> = [];

      function getRole(el: Element): string {
        const role = el.getAttribute("role");
        if (role && role !== "none" && role !== "presentation") return role;
        const tag = el.tagName.toLowerCase();
        const type = (el as HTMLInputElement).type?.toLowerCase();
        if (tag === "input" && type === "checkbox") return "checkbox";
        if (tag === "input" && type === "radio") return "radio";
        if (tag === "input" && (type === "submit" || type === "button")) return "button";
        const tagMap: Record<string, string> = {
          a: "link", button: "button", input: "textbox",
          select: "combobox", textarea: "textbox",
          h1: "heading", h2: "heading", h3: "heading",
          img: "img", form: "form", nav: "navigation",
        };
        return tagMap[tag] ?? tag;
      }

      function getLabel(el: Element): string {
        // aria-label / aria-labelledby
        const ariaLabel = el.getAttribute("aria-label");
        if (ariaLabel?.trim()) return ariaLabel.trim();

        const labelledBy = el.getAttribute("aria-labelledby");
        if (labelledBy) {
          const labelEl = document.getElementById(labelledBy);
          if (labelEl?.textContent?.trim()) return labelEl.textContent.trim().slice(0, 80);
        }

        // <label for="id">
        const id = el.getAttribute("id");
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          if (label?.textContent?.trim()) return label.textContent.trim().slice(0, 80);
        }

        // placeholder / title / alt
        const placeholder = el.getAttribute("placeholder");
        if (placeholder) return placeholder;
        const title = el.getAttribute("title");
        if (title) return title;
        const alt = el.getAttribute("alt");
        if (alt) return alt;

        // innerText (buttons, links, headings)
        const text = (el as HTMLElement).innerText?.trim().replace(/\s+/g, " ").slice(0, 80);
        if (text) return text;

        return "";
      }

      const SELECTORS = [
        "a[href]",
        "button:not([disabled])",
        "input:not([type=hidden])",
        "select",
        "textarea",
        "[role=button]",
        "[role=link]",
        "[role=textbox]",
        "[role=combobox]",
        "[role=option]",
        "[role=menuitem]",
        "[role=tab]",
        "[role=checkbox]",
        "[role=radio]",
        "[role=listitem]",
        "h1", "h2", "h3",
        // Google-specific selectors
        "[data-ved]",
        "[jsname]",
        "[jsaction]",
        "[aria-haspopup]",
        "[aria-expanded]",
        "[aria-selected]",
      ];

      const seen = new Set<Element>();
      const allEls = document.querySelectorAll(SELECTORS.join(","));

      allEls.forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);

        const role = getRole(el);
        const name = getLabel(el);

        // Skip completely invisible elements
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return;

        // Skip elements with no useful information
        if (!name && role === el.tagName.toLowerCase()) return;

        results.push({
          role,
          name: name || `<${el.tagName.toLowerCase()}>`,
          value: (el as HTMLInputElement).value || undefined,
          placeholder: el.getAttribute("placeholder") || undefined,
          disabled: (el as HTMLButtonElement).disabled || false,
          checked: (el as HTMLInputElement).type === "checkbox"
            ? (el as HTMLInputElement).checked
            : undefined,
          tag: el.tagName.toLowerCase(),
        });
      });

      return results.slice(0, 100);
    });

    // If DOM scrape found nothing useful, try Playwright's aria snapshot
    if (nodes.filter(n => n.role !== "heading").length < 3) {
      try {
        const snapshot = await page.locator("body").ariaSnapshot({ timeout: 3000 });
        const snapshotNodes = parseAriaSnapshot(snapshot);
        if (snapshotNodes.length > nodes.length) {
          return snapshotNodes.slice(0, 80).map(n => ({ ...n, id: uuidv4().slice(0, 8) }));
        }
      } catch {
        // ariaSnapshot not available or timed out — use DOM results
      }
    }

    return nodes.map((n) => ({
      ...n,
      id: uuidv4().slice(0, 8),
    }));
  } catch {
    return [];
  }
}

function parseAriaSnapshot(snapshot: string): Omit<AccessibilityNode, "id">[] {
  const nodes: Omit<AccessibilityNode, "id">[] = [];
  const lines = snapshot.split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*-\s+(\w+)\s+"?([^"]*)"?/);
    if (match) {
      const [, role, name] = match;
      if (role && name && role !== "generic" && role !== "none") {
        nodes.push({ role, name: name.trim() });
      }
    }
  }
  return nodes;
}

export function serializeTreeToPrompt(nodes: AccessibilityNode[]): string {
  if (nodes.length === 0) return "(no interactive elements found)";
  const lines = ["Interactive elements on this page:"];
  for (const node of nodes) {
    let line = `[${node.id}] <${node.role}>`;
    if (node.name) line += ` "${node.name}"`;
    if (node.value) line += ` value="${node.value}"`;
    if (node.placeholder) line += ` placeholder="${node.placeholder}"`;
    if (node.checked !== undefined) line += ` checked=${node.checked}`;
    if (node.disabled) line += ` (disabled)`;
    lines.push(line);
  }
  return lines.join("\n");
}
