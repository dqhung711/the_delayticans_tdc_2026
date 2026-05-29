#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const frontendDir = path.join(projectRoot, "frontend");

const npmExec = process.env.npm_execpath;
if (!npmExec) {
  console.error("npm_execpath is not set; cannot safely run nested npm install.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [npmExec, "install"], {
  cwd: frontendDir,
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
