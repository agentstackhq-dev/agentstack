#!/usr/bin/env node
import { runAgentstack } from "./run.js";

const code = await runAgentstack(process.argv.slice(2), {
  cwd: process.cwd(),
  write: (line) => process.stdout.write(`${line}\n`)
});

process.exitCode = code;
