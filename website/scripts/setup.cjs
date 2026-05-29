#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const venvPath = path.join(projectRoot, ".venv");

function run(command, args, options = {}) {
  const useSameNpm = command === "npm" && process.env.npm_execpath;
  const actualCommand = useSameNpm ? process.execPath : command;
  const actualArgs = useSameNpm ? [process.env.npm_execpath, ...args] : args;

  const result = spawnSync(actualCommand, actualArgs, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: useSameNpm ? false : process.platform === "win32",
    ...options
  });

  if (result.error || result.status !== 0) {
    if (result.error) console.error(result.error.message);
    process.exit(result.status ?? 1);
  }
}

const pythonCmd = process.platform === "win32" ? "python" : "python3";
if (!fs.existsSync(venvPath)) {
  run(pythonCmd, ["-m", "venv", ".venv"]);
}

const pipPath =
  process.platform === "win32"
    ? path.join(venvPath, "Scripts", "pip.exe")
    : path.join(venvPath, "bin", "pip");

run(pipPath, ["install", "-r", "api/requirements.txt"], { shell: false });
run("npm", ["install"]);
run("npm", ["run", "prepare-data"]);
