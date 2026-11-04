"use client";

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";

import { Button, Field, Notice, TextInput } from "@/components/ui/form";
import { ApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/orders/labels";
import { formatPrice, toPaise } from "@/lib/money";
import { authorizedRequest } from "@/lib/session/session";
import { useSession } from "@/lib/session/use-session";

interface RefundRecord {
  id: string;
  amount: string;
  reason: string;
  status: "PENDING" | "PROCESSED" | "FAILED";
  providerRefundId: string | null;
  failureReason: string | null;
  createdAt: string;
}

interface RefundSummary {
  paid: string;
  refunded: string;
  refundable: string;
  refunds: RefundRecord[];
}

const MONEY = /^\d{1,8}(\.\d{1,2})?$/;
const REASON_MIN_LENGTH = 3;

const STATUS_LABEL: Record<RefundRecord["status"], string> = {
  PENDING: "Pending: Razorpay is still processing",
  PROCESSED: "Refunded",
  FAILED: "Failed: no money was returned",
};

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** Client-side checks that mirror the server's rules. The server still makes the final decision. */
function validate(
  amount: string,
  reason: string,
  refundable: string,
): { amount?: string; reason?: string } | null {
  const problems: { amount?: string; reason?: string } = {};
  if (amount !== "") {
    if (!MONEY.test(amount) || toPaise(amount) <= 0) {
      problems.amount = "Enter an amount above zero, such as 250 or 250.50";
    } else if (toPaise(amount) > toPaise(refundable)) {
      problems.amount = `The most you can refund is ${formatPrice(refundable)}`;
    }
  }
  if (reason.length < REASON_MIN_LENGTH) {
    problems.reason = `Enter a reason of at least ${REASON_MIN_LENGTH} characters`;
  }
  return Object.keys(problems).length > 0 ? problems : null;
}

/**
 * Refund history for one order. Admins can issue refunds and check pending ones. Staff can read
 * the history only. Customers never reach this screen.
 */
export function RefundPanel({
  orderNumber,
  onChanged,
}: {
  orderNumber: string;
  onChanged: () => void;
}) {
  const session = useSession();
  const roleKnown = session.status !== "loading";
  const isAdmin = session.status === "authenticated" && session.user?.role === "ADMIN";
  const encodedOrder = encodeURIComponent(orderNumber);

  const [summary, setSummary] = useState<RefundSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [problems, setProblems] = useState<{ amount?: string; reason?: string }>({});

  // Each load gets a number. Only the newest answer is kept, so an older response cannot overwrite newer data.
  const latestLoad = useRef(0);
  // Set synchronously before any request, so a second click or Enter press cannot start a second one.
  const actionInFlight = useRef(false);

  const load = useCallback(async () => {
    latestLoad.current += 1;
    const attempt = latestLoad.current;
    try {
      const data = await authorizedRequest<RefundSummary>(`/admin/orders/${encodedOrder}/refunds`);
      if (attempt === latestLoad.current) {
        setSummary(data);
        setLoadError(null);
      }
    } catch (error: unknown) {
      if (attempt === latestLoad.current) {
        setLoadError(messageOf(error, "Could not load refunds. Try again."));
      }
    }
  }, [encodedOrder]);

  useEffect(() => {
    void load();
  }, [load]);

  const finishAction = async () => {
    actionInFlight.current = false;
    await load();
    onChanged();
  };

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (actionInFlight.current || !isAdmin || !summary) return;
    const trimmedAmount = amount.trim();
    const trimmedReason = reason.trim();
    const found = validate(trimmedAmount, trimmedReason, summary.refundable);
    setProblems(found ?? {});
    if (found) return;

    actionInFlight.current = true;
    setIssuing(true);
    setActionError(null);
    setSuccess(null);
    try {
      const refund = await authorizedRequest<RefundRecord>(
        `/admin/orders/${encodedOrder}/refunds`,
        {
          method: "POST",
          body: {
            reason: trimmedReason,
            ...(trimmedAmount ? { amount: trimmedAmount } : {}),
          },
        },
      );
      setSuccess(describeOutcome(refund));
      setAmount("");
      setReason("");
      setConfirmed(false);
    } catch (error: unknown) {
      setActionError(
        messageOf(error, "The refund could not be started. Check the Razorpay dashboard."),
      );
    } finally {
      setIssuing(false);
      await finishAction();
    }
  };

  const checkPending = async (refundId: string) => {
    if (actionInFlight.current || !isAdmin) return;
    actionInFlight.current = true;
    setRefreshingId(refundId);
    setActionError(null);
    setSuccess(null);
    try {
      const refund = await authorizedRequest<RefundRecord>(
        `/admin/orders/${encodedOrder}/refunds/${refundId}/refresh`,
        { method: "POST", body: {} },
      );
      setSuccess(describeOutcome(refund));
    } catch (error: unknown) {
      setActionError(messageOf(error, "Razorpay could not be checked. Try again shortly."));
    } finally {
      setRefreshingId(null);
      await finishAction();
    }
  };

  if (loadError && !summary) {
    return (
      <section className="rounded-md border border-line bg-white p-6">
        <h2 className="font-serif text-xl text-brown">Refunds</h2>
        <div className="mt-4">
          <Notice tone="error">{loadError}</Notice>
        </div>
        <Button variant="secondary" className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </section>
    );
  }
  if (!summary) {
    return (
      <section className="rounded-md border border-line bg-white p-6">
        <h2 className="font-serif text-xl text-brown">Refunds</h2>
        <p className="mt-4 text-sm text-muted">Loading refunds…</p>
      </section>
    );
  }

  const hasPending = summary.refunds.some((refund) => refund.status === "PENDING");
  const canIssue = isAdmin && Number(summary.refundable) > 0 && !hasPending;
  const blockedReason = !confirmed
    ? "Tick the confirmation box to enable the button."
    : reason.trim().length < REASON_MIN_LENGTH
      ? "Enter a reason first."
      : null;

  return (
    <section className="rounded-md border border-line bg-white p-6">
      <h2 className="font-serif text-xl text-brown">Refunds</h2>

      <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="text-xs tracking-wide text-muted uppercase">Paid</dt>
          <dd className="mt-1 text-brown">{formatPrice(summary.paid)}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted uppercase">Refunded</dt>
          <dd className="mt-1 text-brown">{formatPrice(summary.refunded)}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted uppercase">Still refundable</dt>
          <dd className="mt-1 text-brown">{formatPrice(summary.refundable)}</dd>
        </div>
      </dl>

      {hasPending ? (
        <div className="mt-4">
          <Notice tone="error">
            A refund is still pending. It stays pending until Razorpay confirms its outcome, and no
            new refund can be issued on this payment until then. Use “Check status” to ask Razorpay
            again. If Razorpay never received the request, it can stay pending indefinitely; there
            is no manual resolution yet.
          </Notice>
        </div>
      ) : null}

      {summary.refunds.length > 0 ? (
        <ul className="mt-5 divide-y divide-line text-sm">
          {summary.refunds.map((refund) => (
            <li key={refund.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div>
                <p className="text-brown">
                  {formatPrice(refund.amount)} · {refund.reason}
                </p>
                <p className="text-xs text-muted">
                  {formatDate(refund.createdAt)} · {STATUS_LABEL[refund.status]}
                  {refund.providerRefundId ? ` · Razorpay ${refund.providerRefundId}` : ""}
                </p>
                {refund.failureReason ? (
                  <p className="text-xs text-muted">{refund.failureReason}</p>
                ) : null}
              </div>
              {refund.status === "PENDING" && isAdmin ? (
                <Button
                  variant="secondary"
                  disabled={refreshingId !== null || issuing}
                  onClick={() => void checkPending(refund.id)}
                >
                  {refreshingId === refund.id ? "Checking…" : "Check status"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-muted">No refunds yet.</p>
      )}

      {actionError ? (
        <div className="mt-5">
          <Notice tone="error">{actionError}</Notice>
        </div>
      ) : null}
      {success ? (
        <div className="mt-5">
          <Notice tone="success">{success}</Notice>
        </div>
      ) : null}
      {loadError ? (
        <p className="mt-3 text-xs text-muted">The list may be out of date: {loadError}</p>
      ) : null}

      {roleKnown && isAdmin && canIssue ? (
        <form
          onSubmit={(event) => void submit(event)}
          noValidate
          className="mt-6 grid gap-4 border-t border-line pt-6"
        >
          <Field
            label="Amount (₹)"
            htmlFor="refund-amount"
            error={problems.amount}
            hint={`Leave empty to refund the full remaining ${formatPrice(summary.refundable)}.`}
          >
            <TextInput
              id="refund-amount"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
              }}
              inputMode="decimal"
            />
          </Field>
          <Field
            label="Reason"
            htmlFor="refund-reason"
            error={problems.reason}
            hint="Kept with the refund history. Be specific."
          >
            <TextInput
              id="refund-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
              }}
              maxLength={255}
            />
          </Field>
          <label className="flex items-start gap-2 text-sm text-brown">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => {
                setConfirmed(e.target.checked);
              }}
              className="mt-1 size-4 accent-brown"
            />
            I understand this sends money back to the customer through Razorpay.
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              variant="danger"
              disabled={issuing || blockedReason !== null}
              aria-describedby={blockedReason ? "refund-blocked-reason" : undefined}
            >
              {issuing ? "Sending refund…" : "Issue refund"}
            </Button>
            {blockedReason ? (
              <span id="refund-blocked-reason" className="text-xs text-muted">
                {blockedReason}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}

      {roleKnown && !isAdmin ? (
        <p className="mt-5 text-xs text-muted">
          Read-only. Only an admin can issue or check refunds.
        </p>
      ) : null}
      {roleKnown && isAdmin && !canIssue && Number(summary.refundable) > 0 && hasPending ? (
        <p className="mt-5 text-xs text-muted">
          Refunds are paused until the pending refund is resolved.
        </p>
      ) : null}
    </section>
  );
}

function describeOutcome(refund: RefundRecord): string {
  switch (refund.status) {
    case "PROCESSED":
      return `Refunded ${formatPrice(refund.amount)}.`;
    case "PENDING":
      return `Refund of ${formatPrice(refund.amount)} sent. Razorpay is still processing it. Check its status later.`;
    case "FAILED":
      return `Refund of ${formatPrice(refund.amount)} was not accepted. No money was returned.`;
  }
}
