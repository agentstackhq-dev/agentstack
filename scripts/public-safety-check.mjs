#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const self = "scripts/public-safety-check.mjs";
const privateEmailPattern = new RegExp(
  [
    `${"cardinal"}${"kazuro"}@gmail\\.com`,
    `${"jcc"}${"loete97"}@gmail\\.com`
  ].join("|"),
  "i"
);
const ownerHandlePattern = new RegExp(
  [
    `${"Jc"}-${"Cloete"}`,
    `${"jc"}-${"cloete"}`,
    `${"jc"}${"cloete"}`,
    `${"kazu"}${"toxs"}`
  ].join("|")
);

const checks = [
  { label: "personal macOS user path", pattern: /\/Users\// },
  { label: "macOS temp path", pattern: /\/var\/folders|\/private\/var/ },
  { label: "private email address", pattern: privateEmailPattern },
  { label: "personal or provider owner handle", pattern: ownerHandlePattern },
  {
    label: "real Clerk provider id",
    pattern:
      /\b(?:app|user|jtmp|feat|cplan|cprice|cps|ep)_3F[A-Za-z0-9]+\b|\bcsub_item_3F[A-Za-z0-9]+\b/
  },
  { label: "real Vercel provider id", pattern: /\b(?:team|prj)_[A-Za-z0-9]{20,}\b/ },
  {
    label: "real Convex provider url",
    pattern: /dashboard\.convex\.dev\/t\/|https:\/\/[a-z]+-[a-z]+-\d+\.convex\.(?:cloud|site)\b/
  },
  { label: "long-lived npm or GitHub token", pattern: /\bnpm_[A-Za-z0-9]{20,}\b|\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
  { label: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ }
];

const files = git(["ls-files", "-z"]).stdout
  .split("\0")
  .filter(Boolean)
  .filter((file) => file !== self);

const findings = [];
for (const file of files) {
  const buffer = readFileSync(join(repoRoot, file));
  if (buffer.includes(0)) {
    continue;
  }

  const text = buffer.toString("utf8");
  for (const check of checks) {
    const match = check.pattern.exec(text);
    if (match) {
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      findings.push(`${file}:${line}: ${check.label}`);
    }
  }
}

if (findings.length > 0) {
  throw new Error(`Public safety check failed:\n${findings.join("\n")}`);
}

console.log("PASS public safety check");

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed\n${result.stderr}`);
  }
  return result;
}
