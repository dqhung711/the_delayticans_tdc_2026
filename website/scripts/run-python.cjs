#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function venvPythonCandidates(projectRoot) {
  return process.platform === "win32"
    ? [path.join(projectRoot, ".venv", "Scripts", "python.exe")]
    : [path.join(projectRoot, ".venv", "bin", "python")];
}

function resolvePython(projectRoot) {
  for (const candidate of venvPythonCandidates(projectRoot)) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return process.platform === "win32" ? "python" : "python3";
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let cwd = process.cwd();
  if (args[0] === "--cwd") {
    if (!args[1]) {
      console.error("Missing value for --cwd");
      process.exit(1);
    }
    cwd = path.resolve(process.cwd(), args[1]);
    args.splice(0, 2);
  }
  return { cwd, pythonArgs: args };
}

const projectRoot = path.resolve(__dirname, "..");
const { cwd, pythonArgs } = parseArgs(process.argv);
const python = resolvePython(projectRoot);

const result = spawnSync(python, pythonArgs, {
  cwd,
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
