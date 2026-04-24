import type { Page } from "playwright";
import type { HumanApprovalRequest, AgentEventType } from "../types.js";
import { logger } from "../utils/logger.js";

// Button text that strongly indicates an active checkout flow
const PAYMENT_TRIGGER_PATTERNS = [
  /\bpay\s+now\b/i,
  /\bcomplete\s+(purchase|order|booking)\b/i,
  /\bconfirm\s+(payment|order|and\s+pay)\b/i,
  /\bsubmit\s+payment\b/i,
  /\bplace\s+order\b/i,
  /\bproceed\s+to\s+payment\b/i,
  /\bcontinue\s+to\s+payment\b/i,
  /\bbook\s+(now|flight|and\s+pay)\b/i,
];

const SENSITIVE_FIELD_PATTERNS = [
  /cvv|cvc|security\s+code/i,
  /card\s+number/i,
  /expir(y|ation)/i,
  /billing\s+address/i,
  /payment\s+method/i,
];

// URL fragments that indicate we're past the browsing phase and inside a
// booking/checkout flow. Pairing these with a "Continue/Review/Book" button
// is enough to gate — we don't need to wait for the CVV field.
const CHECKOUT_URL_PATTERNS = [
  /\/checkout(\/|\?|$)/i,
  /\/booking(\/|\?|$)/i,
  /\/book(\/|\?|$)/i,
  /\/payment(\/|\?|$)/i,
  /\/order(\/|\?|$)/i,
  /\/reserve(\/|\?|$)/i,
  /google\.com\/travel\/flights\/booking/i,
  /flights\/.*\/book/i,
  /amazon\.[a-z.]+\/gp\/buy/i,
  /stripe\.com\/.*checkout/i,
];

// Soft-commit button text — not enough on its own, but combined with a
// checkout-URL it's a reliable gate.
const SOFT_COMMIT_PATTERNS = [
  /\bcontinue\b/i,
  /\breview\b/i,
  /\bproceed\b/i,
  /\bconfirm\b/i,
  /\bbook\b/i,
];

export type PaymentGateEventEmitter = (
  type: AgentEventType,
  data: Record<string, unknown>
) => void;

export class PaymentGate {
  private pendingApprovals = new Map<
    string,
    (approved: boolean, input?: string) => void
  >();

  async checkPage(
    page: Page,
    sessionId: string,
    emit: PaymentGateEventEmitter
  ): Promise<boolean> {
    const triggered = await this.detectPaymentContext(page);

    if (triggered) {
      const screenshot = await page
        .screenshot({ type: "jpeg", quality: 70 })
        .then((b) => b.toString("base64"));

      const title = await page.title();
      const url = page.url();

      logger.warn(`PaymentGate triggered on ${url}`);

      emit("payment:gate_triggered", {
        sessionId,
        pageTitle: title,
        pageUrl: url,
        screenshot,
        message:
          "SkyWalker has detected a payment screen. Human approval required before proceeding.",
      });
    }

    return triggered;
  }

  async waitForApproval(
    sessionId: string,
    request: HumanApprovalRequest,
    emit: PaymentGateEventEmitter,
    timeoutMs = 300_000
  ): Promise<{ approved: boolean; userInput?: string }> {
    logger.info(`Waiting for human approval (session ${sessionId})`);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingApprovals.delete(sessionId);
        logger.warn("Human approval timed out — treating as rejected");
        resolve({ approved: false });
      }, timeoutMs);

      this.pendingApprovals.set(sessionId, (approved, userInput) => {
        clearTimeout(timer);
        this.pendingApprovals.delete(sessionId);
        emit(approved ? "payment:approved" : "payment:rejected", {
          sessionId,
        });
        resolve({ approved, userInput });
      });

      emit("agent:require_human", {
        sessionId,
        reason: request.reason,
        screenshot: request.screenshot,
        pageTitle: request.pageTitle,
        pageUrl: request.pageUrl,
      });
    });
  }

  resolveApproval(sessionId: string, approved: boolean, userInput?: string): boolean {
    const resolver = this.pendingApprovals.get(sessionId);
    if (!resolver) return false;
    resolver(approved, userInput);
    return true;
  }

  private async detectPaymentContext(page: Page): Promise<boolean> {
    const url = page.url();
    const isCheckoutUrl = CHECKOUT_URL_PATTERNS.some((p) => p.test(url));

    return page.evaluate(
      ({
        paymentPatterns,
        sensitivePatterns,
        softCommitPatterns,
        checkoutUrl,
      }: {
        paymentPatterns: string[];
        sensitivePatterns: string[];
        softCommitPatterns: string[];
        checkoutUrl: boolean;
      }) => {
        const buttons = Array.from(
          document.querySelectorAll("button, input[type=submit], a")
        );
        const buttonText = buttons
          .map((b) => b.textContent ?? "")
          .join(" ");
        const inputs = Array.from(document.querySelectorAll("input, label"));
        const inputText = inputs
          .map((i) => `${i.getAttribute("placeholder") ?? ""} ${i.textContent ?? ""}`)
          .join(" ");

        const hasPayButton = paymentPatterns.some((p) =>
          new RegExp(p, "i").test(buttonText)
        );
        const hasSensitiveFields = sensitivePatterns.some((p) =>
          new RegExp(p, "i").test(inputText)
        );
        const hasSoftCommit = softCommitPatterns.some((p) =>
          new RegExp(p, "i").test(buttonText)
        );

        // Strong trigger: explicit pay button + sensitive card fields
        if (hasPayButton && hasSensitiveFields) return true;
        // Strong trigger: the URL is clearly a checkout/booking flow and
        // there's any commit-ish button visible. Catches fare-selection pages
        // BEFORE the card form is reached.
        if (checkoutUrl && (hasPayButton || hasSoftCommit)) return true;
        return false;
      },
      {
        paymentPatterns: PAYMENT_TRIGGER_PATTERNS.map((r) => r.source),
        sensitivePatterns: SENSITIVE_FIELD_PATTERNS.map((r) => r.source),
        softCommitPatterns: SOFT_COMMIT_PATTERNS.map((r) => r.source),
        checkoutUrl: isCheckoutUrl,
      }
    );
  }
}
