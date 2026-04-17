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
            await page
              .locator(`[data-sw-id="${action.elementId}"]`)
              .first()
              .click()
              .catch(() => page.keyboard.press("Tab"));
          }
          await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
          break;
        }

        case "type": {
          if (action.clearFirst) {
            await page.keyboard.press("Control+A");
            await page.keyboard.press("Delete");
          }
          await page.keyboard.type(action.text, { delay: 30 });
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
            return el?.innerText ?? "";
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
