export type FeatureSurface = "web" | "mobile";
export type FeatureBackend = "convex";

export interface ParsedFeatureName {
  input: string;
  slug: string;
  title: string;
  camel: string;
}

export interface FeaturePlanOptions {
  surfaces: readonly string[];
  backend: string;
}

export interface PlannedFeatureFile {
  path: string;
  content: string;
}

export interface FeaturePlan {
  name: ParsedFeatureName;
  surfaces: FeatureSurface[];
  backend: FeatureBackend;
  files: PlannedFeatureFile[];
}

const supportedSurfaces = ["web", "mobile"] as const;
const supportedBackend = "convex";

export function parseFeatureName(input: string): ParsedFeatureName {
  if (input.length === 0) {
    throw new Error("Feature name is required.");
  }

  if (!/[A-Za-z0-9]/.test(input)) {
    throw new Error("Feature name must contain at least one letter or number.");
  }

  if (!/^[A-Za-z0-9 _-]+$/.test(input)) {
    throw new Error("Feature name can only contain letters, numbers, spaces, underscores, and hyphens.");
  }

  const parts = input
    .trim()
    .split(/[ _-]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());

  const slug = parts.join("-");
  const title = parts.map(capitalize).join(" ");
  const camel = parts
    .map((part, index) => (index === 0 ? part : capitalize(part)))
    .join("");

  return { input, slug, title, camel };
}

export function planFeatureFiles(nameInput: string, options: FeaturePlanOptions): FeaturePlan {
  const name = parseFeatureName(nameInput);
  const surfaces = validateSurfaces(options.surfaces);
  const backend = validateBackend(options.backend);
  const files: PlannedFeatureFile[] = [
    {
      path: `packages/domain/src/features/${name.slug}.ts`,
      content: buildDomainFeature(name)
    }
  ];

  if (backend === "convex") {
    files.push({
      path: `convex/features/${name.slug}.ts`,
      content: buildConvexFeature(name)
    });
  }

  if (surfaces.includes("web")) {
    files.push({
      path: `apps/web/src/features/${name.slug}.ts`,
      content: buildWebFeature(name)
    });
  }

  if (surfaces.includes("mobile")) {
    files.push({
      path: `apps/mobile/src/features/${name.slug}.ts`,
      content: buildMobileFeature(name)
    });
  }

  files.push(
    {
      path: `packages/telemetry/src/features/${name.slug}.ts`,
      content: buildTelemetryFeature(name, surfaces, backend)
    },
    {
      path: `docs/agentstack/features/${name.slug}.md`,
      content: buildFeatureDocs(name, surfaces, backend)
    }
  );

  return { name, surfaces, backend, files };
}

function validateSurfaces(input: readonly string[]): FeatureSurface[] {
  if (input.length === 0) {
    throw new Error("At least one feature surface is required. Supported surfaces: web, mobile.");
  }

  const surfaces: FeatureSurface[] = [];

  for (const surface of input) {
    if (!isFeatureSurface(surface)) {
      throw new Error(`Unsupported feature surface "${surface}". Supported surfaces: web, mobile.`);
    }

    if (!surfaces.includes(surface)) {
      surfaces.push(surface);
    }
  }

  return supportedSurfaces.filter((surface) => surfaces.includes(surface));
}

function validateBackend(input: string): FeatureBackend {
  if (input !== supportedBackend) {
    throw new Error(`Unsupported feature backend "${input}". Supported backend: convex.`);
  }

  return input;
}

function buildDomainFeature(name: ParsedFeatureName): string {
  return `export const ${name.camel}Feature = {
  slug: "${name.slug}",
  title: "${name.title}"
} as const;

export type ${typeName(name)}FeatureSlug = typeof ${name.camel}Feature.slug;
`;
}

function buildConvexFeature(name: ParsedFeatureName): string {
  return `import { ${name.camel}Feature } from "../../packages/domain/src/features/${name.slug}.js";

export const ${name.camel}ConvexFeature = {
  ...${name.camel}Feature,
  backend: "convex"
} as const;
`;
}

function buildWebFeature(name: ParsedFeatureName): string {
  return `import { ${name.camel}Feature } from "../../../../packages/domain/src/features/${name.slug}.js";

export const ${name.camel}WebFeature = {
  ...${name.camel}Feature,
  surface: "web"
} as const;
`;
}

function buildMobileFeature(name: ParsedFeatureName): string {
  return `import { ${name.camel}Feature } from "../../../../packages/domain/src/features/${name.slug}.js";

export const ${name.camel}MobileFeature = {
  ...${name.camel}Feature,
  surface: "mobile"
} as const;
`;
}

function buildTelemetryFeature(
  name: ParsedFeatureName,
  surfaces: readonly FeatureSurface[],
  backend: FeatureBackend
): string {
  return `export const ${name.camel}Telemetry = {
  feature: "${name.slug}",
  surfaces: ${JSON.stringify(surfaces)},
  backend: "${backend}",
  events: {
    viewed: "${name.slug}.viewed",
    submitted: "${name.slug}.submitted"
  }
} as const;
`;
}

function buildFeatureDocs(
  name: ParsedFeatureName,
  surfaces: readonly FeatureSurface[],
  backend: FeatureBackend
): string {
  const surfaceList = surfaces.map((surface) => `- ${surface}`).join("\n");

  return `# ${name.title} Feature

Generated anchors for \`${name.slug}\`.

## Surfaces

${surfaceList}

## Backend

- ${backend}

## Files

- \`packages/domain/src/features/${name.slug}.ts\`
- \`convex/features/${name.slug}.ts\`
${surfaces.includes("web") ? `- \`apps/web/src/features/${name.slug}.ts\`\n` : ""}${surfaces.includes("mobile") ? `- \`apps/mobile/src/features/${name.slug}.ts\`\n` : ""}- \`packages/telemetry/src/features/${name.slug}.ts\`
`;
}

function isFeatureSurface(input: string): input is FeatureSurface {
  return supportedSurfaces.includes(input as FeatureSurface);
}

function capitalize(input: string): string {
  return input.slice(0, 1).toUpperCase() + input.slice(1);
}

function typeName(name: ParsedFeatureName): string {
  return name.title.replaceAll(" ", "");
}
