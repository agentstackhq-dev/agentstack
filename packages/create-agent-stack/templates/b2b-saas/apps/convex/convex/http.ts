import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();
const entitlementKey = "feature.auditLog" as const;
const providerFeature = "audit_log";
const providerPlan = "agentstack_m3_audit_log";

http.route({
  path: "/agentstack/webhooks/clerk/billing",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    const signingToken = process.env["CLERK_WEBHOOK_SIGNING_SECRET"];

    if (!signingToken) {
      return new Response("missing webhook secret", { status: 500 });
    }

    const messageId = getHeader(headers, "svix-id");
    const timestamp = getHeader(headers, "svix-timestamp");
    const signature = getHeader(headers, "svix-signature");

    if (!messageId || !timestamp || !signature) {
      return new Response("missing svix headers", { status: 400 });
    }

    const verified = await verifySvixSignature({ body, messageId, timestamp, signature, secret: signingToken });
    if (!verified) {
      return new Response("invalid signature", { status: 400 });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    await ctx.runMutation(internal.billing.applyClerkBillingEvent, {
      provider: "clerk",
      messageId,
      ...normalizeClerkBillingEvent(payload)
    });

    return new Response("ok", { status: 200 });
  })
});

export default http;

function normalizeClerkBillingEvent(payload: Record<string, unknown>) {
  const data = readRecord(payload.data);
  const eventType = firstString(payload.type) ?? "unknown";
  const providerPayerType = inferPayerType(data);
  const providerPayerId = firstString(
    data.organization_id,
    readRecord(data.organization)?.id,
    data.user_id,
    readRecord(data.user)?.id,
    data.customer_id,
    readRecord(data.customer)?.id,
    readRecord(data.payer)?.id,
    data.payer_id
  );
  const allowed = inferAllowed(eventType);

  return {
    eventType,
    receivedAt: new Date().toISOString(),
    entitlementKey,
    providerFeature:
      firstString(data.feature_slug, data.feature_key, readRecord(data.feature)?.slug, readRecord(data.feature)?.key) ??
      providerFeature,
    providerPlan:
      firstString(data.plan_slug, data.plan_key, readRecord(data.plan)?.slug, readRecord(data.plan)?.key) ??
      providerPlan,
    providerPayerType,
    providerPayerId,
    allowed,
    redactedSummary: `clerk billing ${eventType}; payer=${providerPayerId ? "present" : "missing"}`
  };
}

function inferAllowed(eventType: string): boolean | undefined {
  const normalized = eventType.toLowerCase();
  if (
    normalized.includes("canceled") ||
    normalized.includes("cancelled") ||
    normalized.includes("ended") ||
    normalized.includes("deleted") ||
    normalized.includes("past_due")
  ) {
    return false;
  }
  if (normalized.includes("subscription")) {
    return true;
  }
  return undefined;
}

function inferPayerType(data: Record<string, unknown>): "user" | "organization" | undefined {
  if (firstString(data.organization_id, readRecord(data.organization)?.id)) {
    return "organization";
  }
  if (firstString(data.user_id, readRecord(data.user)?.id)) {
    return "user";
  }
  const payerType = firstString(readRecord(data.payer)?.type, data.payer_type);
  return payerType === "organization" || payerType === "user" ? payerType : undefined;
}

async function verifySvixSignature(input: {
  body: string;
  messageId: string;
  timestamp: string;
  signature: string;
  secret: string;
}): Promise<boolean> {
  const secretBytes = decodeSecret(input.secret);
  const signedContent = `${input.messageId}.${input.timestamp}.${input.body}`;
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign"
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = encodeBase64(new Uint8Array(signature));

  return parseSvixSignatures(input.signature).some((candidate) => constantTimeEqual(candidate, expected));
}

function parseSvixSignatures(header: string): string[] {
  return header
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(","))
    .filter(([version]) => version === "v1")
    .map(([, signature]) => signature)
    .filter((signature): signature is string => typeof signature === "string" && signature.length > 0);
}

function decodeSecret(secret: string): Uint8Array {
  const prefixed = `${"whsec"}_`;
  const encoded = secret.startsWith(prefixed) ? secret.slice(prefixed.length) : secret;
  return Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function getHeader(headers: Record<string, string>, name: string): string | undefined {
  return headers[name] ?? headers[name.toLowerCase()];
}

function readRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}
