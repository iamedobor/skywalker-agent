import type { Page } from "playwright";
import type { HumanApprovalRequest, AgentEventType } from "../types.js";
import { logger } from "../utils/logger.js";

// Only trigger on buttons that are part of an actual checkout flow
const PAYMENT_TRIGGER_PATTERNS = [
  /\bpay\s+now\b/i,
  /\bcomplete\s+(purchase|order|booking)\b/i,
  /\bconfirm\s+(payment|order)\b/i,
  /\bsubmit\s+payment\b/i,
  /\bplace\s+order\b/i,
  /\bproceed\s+to\s+payment\b/i,
];

const SENSITIVE_FIELD_PATTERNS = [
  /cvv|cvc|security\s+code/i,
  /card\s+number/i,
  /expir(y|ation)/i,
  /billing\s+address/i,
  /payment\s+method/i,
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
    return page.evaluate(
      ({
        paymentPatterns,
        sensitivePatterns,
      }: {
        paymentPatterns: string[];
        sensitivePatterns: string[];
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

        const allText = `${buttonText} ${inputText}`;

        const hasPayButton = paymentPatterns.some((p) =>
          new RegExp(p, "i").test(buttonText)
        );
        const hasSensitiveFields = sensitivePatterns.some((p) =>
          new RegExp(p, "i").test(inputText)
        );

        // Require BOTH a payment button AND sensitive fields to avoid false positives
        return hasPayButton && hasSensitiveFields;
      },
      {
        paymentPatterns: PAYMENT_TRIGGER_PATTERNS.map((r) => r.source),
        sensitivePatterns: SENSITIVE_FIELD_PATTERNS.map((r) => r.source),
      }
    );
  }
}
