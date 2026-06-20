export interface ParsedBillingPlanName {
  input: string;
  slug: string;
  title: string;
  camel: string;
  pascal: string;
}

export interface BillingPlanOptions {
  entitlements: readonly string[];
  seats?: number;
}

export interface PlannedBillingPlanFile {
  path: string;
  content: string;
}

export interface BillingPlanFilePlan {
  name: ParsedBillingPlanName;
  entitlements: string[];
  seats: number;
  files: PlannedBillingPlanFile[];
}

const entitlementKeyPattern = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/;

export function parseBillingPlanName(input: string): ParsedBillingPlanName {
  if (input.length === 0) {
    throw new Error("Billing plan name is required.");
  }

  if (!/[A-Za-z0-9]/.test(input)) {
    throw new Error("Billing plan name must contain at least one letter or number.");
  }

  if (!/^[A-Za-z0-9 _-]+$/.test(input)) {
    throw new Error("Billing plan name can only contain letters, numbers, spaces, underscores, and hyphens.");
  }

  const parts = input
    .trim()
    .split(/[ _-]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
  const slug = parts.join("-");
  const title = parts.map(capitalize).join(" ");
  const rawCamel = parts.map((part, index) => (index === 0 ? part : capitalize(part))).join("");
  const rawPascal = parts.map(capitalize).join("");
  const camel = startsWithIdentifierCharacter(rawCamel) ? rawCamel : `plan${rawPascal}`;
  const pascal = startsWithIdentifierCharacter(rawPascal) ? rawPascal : `Plan${rawPascal}`;

  return { input, slug, title, camel, pascal };
}

export function planBillingPlanFiles(
  input: string,
  options: BillingPlanOptions
): BillingPlanFilePlan {
  const name = parseBillingPlanName(input);
  const entitlements = validateEntitlements(options.entitlements);
  const seats = validateSeats(options.seats);

  return {
    name,
    entitlements,
    seats,
    files: [
      {
        path: `packages/domain/src/billing-plans/${name.slug}.ts`,
        content: buildDomainBillingPlan(name, entitlements, seats)
      },
      {
        path: `convex/billing-plans/${name.slug}.ts`,
        content: buildConvexBillingPlan(name)
      },
      {
        path: `apps/web/src/billing-plans/${name.slug}.ts`,
        content: buildSurfaceBillingPlan(name, "web")
      },
      {
        path: `apps/mobile/src/billing-plans/${name.slug}.ts`,
        content: buildSurfaceBillingPlan(name, "mobile")
      },
      {
        path: `packages/telemetry/src/billing-plans/${name.slug}.ts`,
        content: buildTelemetryBillingPlan(name)
      },
      {
        path: `docs/agentstack/billing-plans/${name.slug}.md`,
        content: buildBillingPlanDocs(name, entitlements, seats)
      }
    ]
  };
}

function validateEntitlements(input: readonly string[]): string[] {
  const entitlements = input.length === 0 ? ["seats.included"] : input;
  const deduped: string[] = [];

  for (const entitlement of entitlements) {
    if (!entitlementKeyPattern.test(entitlement)) {
      throw new Error(`Invalid entitlement key "${entitlement}".`);
    }

    if (!deduped.includes(entitlement)) {
      deduped.push(entitlement);
    }
  }

  return deduped;
}

function validateSeats(input: number | undefined): number {
  const seats = input ?? 1;

  if (!Number.isInteger(seats) || seats < 1) {
    throw new Error("Included seats must be a positive integer.");
  }

  return seats;
}

function buildDomainBillingPlan(
  name: ParsedBillingPlanName,
  entitlements: readonly string[],
  seats: number
): string {
  return `import type { AgentstackEntitlement } from "../saas-spine.js";

export const ${name.camel}EntitlementKeys = [
${entitlements.map((entitlement) => `  "${entitlement}"`).join(",\n")}
] as const;

export type ${name.pascal}BillingPlanEntitlement = (typeof ${name.camel}EntitlementKeys)[number];

const ${name.camel}Entitlements: readonly ${name.pascal}BillingPlanEntitlement[] = ${name.camel}EntitlementKeys;

export const ${name.camel}BillingPlan = {
  slug: "${name.slug}",
  title: "${name.title}",
  clerkPlanKey: "${name.slug}",
  clerkProductKey: "${name.slug}",
  includedSeats: ${seats},
  entitlements: ${name.camel}Entitlements
} as const;

export type ${name.pascal}BillingPlan = typeof ${name.camel}BillingPlan;

export function ${name.camel}PlanHasEntitlement(
  entitlement: AgentstackEntitlement | ${name.pascal}BillingPlanEntitlement
): boolean {
  return (${name.camel}Entitlements as readonly string[]).includes(entitlement);
}
`;
}

function buildConvexBillingPlan(name: ParsedBillingPlanName): string {
  return `import { ${name.camel}BillingPlan } from "../../packages/domain/src/billing-plans/${name.slug}.js";

export const ${name.camel}BillingPlanSync = {
  plan: ${name.camel}BillingPlan,
  billingSubscriptions: "billingSubscriptions",
  entitlements: "entitlements",
  webhookEvents: ["subscription.created", "subscription.updated", "subscription.deleted"],
  mutation: "billing.apply${name.pascal}SubscriptionUpdate"
} as const;
`;
}

function buildSurfaceBillingPlan(name: ParsedBillingPlanName, surface: "web" | "mobile"): string {
  const exportName = `${name.camel}${capitalize(surface)}BillingGate`;

  return `import { ${name.camel}BillingPlan } from "../../../../packages/domain/src/billing-plans/${name.slug}.js";

export const ${exportName} = {
  plan: ${name.camel}BillingPlan,
  surface: "${surface}",
  requiredEntitlements: ${name.camel}BillingPlan.entitlements
} as const;
`;
}

function buildTelemetryBillingPlan(name: ParsedBillingPlanName): string {
  return `export const ${name.camel}BillingPlanTelemetry = {
  plan: "${name.slug}",
  events: {
    viewed: "billing.plan.${name.slug}.viewed",
    entitlementChecked: "billing.plan.${name.slug}.entitlement.checked"
  }
} as const;
`;
}

function buildBillingPlanDocs(
  name: ParsedBillingPlanName,
  entitlements: readonly string[],
  seats: number
): string {
  return `# ${name.title} Billing Plan

Generated billing-plan anchors for \`${name.slug}\`.

## Included Seats

- ${seats}

## Entitlements

${entitlements.map((entitlement) => `- \`${entitlement}\``).join("\n")}

## Files

- \`packages/domain/src/billing-plans/${name.slug}.ts\`
- \`convex/billing-plans/${name.slug}.ts\`
- \`apps/web/src/billing-plans/${name.slug}.ts\`
- \`apps/mobile/src/billing-plans/${name.slug}.ts\`
- \`packages/telemetry/src/billing-plans/${name.slug}.ts\`
- \`docs/agentstack/billing-plans/${name.slug}.md\`
`;
}

function capitalize(input: string): string {
  return input.slice(0, 1).toUpperCase() + input.slice(1);
}

function startsWithIdentifierCharacter(input: string): boolean {
  return /^[A-Za-z_$]/.test(input);
}
