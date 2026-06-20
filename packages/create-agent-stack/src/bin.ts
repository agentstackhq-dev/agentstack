#!/usr/bin/env tsx
import { resolve } from "node:path";

import { generateProject } from "./generate.js";

const name = process.argv[2];

if (!name) {
  process.stderr.write("Usage: create-agent-stack <app-name>\n");
  process.exitCode = 1;
} else {
  await generateProject({ name, targetDir: resolve(process.cwd(), name) });
  process.stdout.write(`Created ${name}\n`);
}
