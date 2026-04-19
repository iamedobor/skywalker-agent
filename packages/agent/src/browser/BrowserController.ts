import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import type { AgentConfig, AgentAction, ActionResult } from "../types.js";
import { logger } from "../utils/logger.js";

export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async launch(config: AgentConfig): Promise<void> {
    const launcher =
      config.browserType === "firefox"
        ? firefox
        : config.browserType === "webkit"
          ? webkit
          : chromium;

    const launchOptions: Parameters<typeof launcher.launch>[0] = {
      headless: config.headless,
    };

    this.browser = await launcher.launch(launchOptions);

    const contextOptions: Parameters<typeof this.browser.newContext>[0] = {
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    };

    if (config.userDataDir) {
      this.context = await launcher.launchPersistentContext(
        config.userDataDir,
        { ...launchOptions, ...contextOptions }
      );
      const pages = this.context.pages();
      this.page = pages[0] ?? (await this.context.newPage());
    } else {
      this.context = await this.browser.newContext(contextOptions);
      this.page = await this.context.newPage();
    }

    logger.info(`Browser launched: ${config.browserType}`);
  }

  getPage(): Page {
    if (!this.page) throw new Error("Browser not launched");
    return this.page;
  }

  async screenshot(): Promise<string> {
    const page = this.getPage();
    try {
      const buffer = await page.screenshot({ type: "jpeg", quality: 70, timeout: 10000 });
      return buffer.toString("base64");
    } catch {
      // Page may still be loading — wait briefly and retry once
      await page.waitForTimeout(1000);
      const buffer = await page.screenshot({ type: "jpeg", quality: 70, timeout: 10000 });
      return buffer.toString("base64");
    }
  }

  async currentUrl(): Promise<string> {
    return this.getPage().url();
  }

  async executeAction(action: AgentAction): Promise<ActionResult> {
    const page = this.getPage();

    try {
      switch (action.type) {
        case "click": {
          if (action.coordinates) {
            await page.mouse.click(action.coordinates.x, action.coordinates.y);
          } else if (action.elementId) {
            const clicked = await page
              .locator(`[data-sw-id="${action.elementId}"]`)
              .first()
              .click({ timeout: 3000 })
              .then(() => true)
              .catch(() => false);

            if (!clicked) {
              // data-sw-id not in DOM — try role+name using element name from description
              // Descriptions like: "Click 'Where from?' combobox" or "Click the Search button"
              const nameMatch =
                action.description.match(/["']([^"']{2,60})["']/) ??
                action.description.match(/click\s+(?:the\s+|on\s+)?([A-Za-z][^\s,.?]{1,40}(?:\s[^\s,.?]{1,20})?)\s*(?:button|link|tab|combobox|field|input)?/i);
              const elName = nameMatch?.[1]?.trim();
              if (elName) {
                const fallback =
                  await page.getByRole("combobox", { name: elName, exact: false }).first().click({ timeout: 2000 }).then(() => true).catch(() => false) ||
                  await page.getByRole("button", { name: elName, exact: false }).first().click({ timeout: 2000 }).then(() => true).catch(() => false) ||
                  await page.getByLabel(elName, { exact: false }).first().click({ timeout: 2000 }).then(() => true).catch(() => false) ||
                  await page.getByText(elName, { exact: false }).first().click({ timeout: 2000 }).then(() => true).catch(() => false);
                void fallback;
              }
            }
          }
          await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
          break;
        }

        case "type": {
          // Only click by elementId if it actually exists in the DOM.
          // Attempting to click a non-existent data-sw-id steals focus from
          // already-focused Shadow DOM inputs (e.g. Google Flights comboboxes).
          if (action.elementId) {
            const exists = await page.locator(`[data-sw-id="${action.elementId}"]`).count().catch(() => 0);
            if (exists > 0) {
              await page.locator(`[data-sw-id="${action.elementId}"]`).first()
                .click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(300);
            }
            // If not found in DOM, the field is likely already focused from the previous action — proceed directly
          }

          if (action.clearFirst) {
            // Use keyboard select-all + delete so sites like Google Flights still receive
            // proper input events (fill() bypasses them and breaks autocomplete)
            await page.keyboard.press("Control+A");
            await page.waitForTimeout(50);
            await page.keyboard.press("Backspace");
            await page.waitForTimeout(100);
          }

          // Slow typing (60ms/char) gives autocomplete dropdowns time to appear
          await page.keyboard.type(action.text, { delay: 60 });
          await page.waitForTimeout(600); // let dropdown load after typing
          break;
        }

        case "scroll": {
          const delta =
            action.direction === "down" || action.direction === "right"
              ? action.amount
              : -action.amount;
          const isVertical =
            action.direction === "up" || action.direction === "down";
          await page.mouse.wheel(
            isVertical ? 0 : delta,
            isVertical ? delta : 0
          );
          await page.waitForTimeout(300);
          break;
        }

        case "hover": {
          if (action.coordinates) {
            await page.mouse.move(action.coordinates.x, action.coordinates.y);
          }
          await page.waitForTimeout(200);
          break;
        }

        case "navigate": {
          await page.goto(action.url, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForTimeout(1500);
          break;
        }

        case "wait": {
          await page.waitForTimeout(action.ms);
          break;
        }

        case "select": {
          await page.selectOption(`[data-sw-id="${action.elementId}"]`, action.value);
          break;
        }

        case "click_text": {
          const t = action.text;
          const exact = action.exact ?? false;
          // Try role-based locators first (pierce Shadow DOM, match by accessible name)
          // "option" covers autocomplete dropdown items (Google Flights, etc.)
          const clicked =
            await page.getByRole("option",   { name: t, exact }).first().click({ timeout: 2000 }).then(() => true).catch(() => false) ||
            await page.getByRole("button",   { name: t, exact }).first().click({ timeout: 2000 }).then(() => true).catch(() => false) ||
            await page.getByRole("combobox", { name: t, exact }).first().click({ timeout: 2000 }).then(() => true).catch(() => false) ||
            await page.getByRole("link",     { name: t, exact }).first().click({ timeout: 2000 }).then(() => true).catch(() => false) ||
            await page.getByRole("tab",      { name: t, exact }).first().click({ timeout: 2000 }).then(() => true).catch(() => false) ||
            await page.getByRole("menuitem", { name: t, exact }).first().click({ timeout: 2000 }).then(() => true).catch(() => false) ||
            await page.getByLabel(t, { exact }).first().click({ timeout: 2000 }).then(() => true).catch(() => false) ||
            await page.getByText(t, { exact }).first().click({ timeout: 4000 }).then(() => true).catch(() => false) ||
            await page.locator(`text=${t}`).first().click({ timeout: 2000 }).then(() => true).catch(() => false);
          void clicked;
          await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
          break;
        }

        case "triple_click": {
          if (action.coordinates) {
            await page.mouse.click(action.coordinates.x, action.coordinates.y, { clickCount: 3 });
          } else if (action.elementId) {
            const el = page.locator(`[data-sw-id="${action.elementId}"]`).first();
            await el.click({ clickCount: 3 }).catch(async () => {
              // data-sw-id not in DOM — select-all on the currently focused element
              await page.keyboard.press("Meta+A").catch(() => {});
              await page.keyboard.press("Control+A").catch(() => {});
            });
          } else {
            // No target — select all text in whatever is focused
            await page.keyboard.press("Meta+A").catch(() => {});
            await page.keyboard.press("Control+A").catch(() => {});
          }
          await page.waitForTimeout(100);
          break;
        }

        case "key_press": {
          const KEY_MAP: Record<string, string> = {
            ctrl: "Control", cmd: "Meta", alt: "Alt", shift: "Shift",
            enter: "Enter", tab: "Tab", escape: "Escape", esc: "Escape",
            backspace: "Backspace", delete: "Delete", space: "Space",
            arrowdown: "ArrowDown", arrowup: "ArrowUp",
            arrowleft: "ArrowLeft", arrowright: "ArrowRight",
            "ctrl+a": "Control+A", "ctrl+c": "Control+C",
            "ctrl+v": "Control+V", "ctrl+x": "Control+X",
            "meta+a": "Meta+A",
          };
          const normalized = KEY_MAP[action.key.toLowerCase()] ?? action.key;
          await page.keyboard.press(normalized);
          await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
          break;
        }

        case "extract": {
          const content = await page.evaluate((sel) => {
            const el = sel ? document.querySelector(sel) : document.body;
            return (el as HTMLElement)?.innerText ?? "";
          }, action.selector ?? null);
          return { success: true, extractedData: content };
        }

        case "complete":
        case "backtrack":
        case "require_human":
          return { success: true };
      }

      return {
        success: true,
        newUrl: page.url(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Action failed: ${message}`);
      return { success: false, error: message };
    }
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
    this.page = null;
    this.context = null;
    this.browser = null;
  }
}
