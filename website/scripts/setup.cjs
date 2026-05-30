#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  isWin,
  resolvePython,
  resolvePip,
  run,
  runNpm,
  systemPythonCommand,
  systemPythonArgs,
} = require("./lib/platform.cjs");

const projectRoot = path.resolve(__dirname, "..");
const venvPath = path.join(projectRoot, ".venv");

if (!fs.existsSync(venvPath)) {
  const py = systemPythonCommand();
  run(py, systemPythonArgs(["-m", "venv", ".venv"]), {
    cwd: projectRoot,
    shell: isWin && py === "python",
  });
}

const pip = resolvePip(projectRoot);
run(pip.command, [...pip.argsPrefix, "install", "-r", "api/requirements.txt"], {
  cwd: projectRoot,
  shell: pip.shell,
});

runNpm(["install"], projectRoot);
runNpm(["run", "prepare-data"], projectRoot);

// Confirm venv python resolves after setup
const { command } = resolvePython(projectRoot);
console.log(`Python venv: ${command}`);
