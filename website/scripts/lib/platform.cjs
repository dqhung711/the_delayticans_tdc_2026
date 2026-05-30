#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const isWin = process.platform === "win32";

function venvPythonPath(projectRoot) {
  return isWin
    ? path.join(projectRoot, ".venv", "Scripts", "python.exe")
    : path.join(projectRoot, ".venv", "bin", "python");
}

function venvPipPath(projectRoot) {
  return isWin
    ? path.join(projectRoot, ".venv", "Scripts", "pip.exe")
    : path.join(projectRoot, ".venv", "bin", "pip");
}

function systemPythonCommand() {
  if (isWin) {
    const py = spawnSync("py", ["-3", "-c", "print(1)"], { stdio: "ignore" });
    if (py.status === 0) return "py";
    return "python";
  }
  return "python3";
}

function systemPythonArgs(baseArgs) {
  if (isWin && systemPythonCommand() === "py") {
    return ["-3", ...baseArgs];
  }
  return baseArgs;
}

function resolvePython(projectRoot) {
  const venvPy = venvPythonPath(projectRoot);
  if (fs.existsSync(venvPy)) return { command: venvPy, argsPrefix: [], shell: false };
  const cmd = systemPythonCommand();
  return { command: cmd, argsPrefix: cmd === "py" ? ["-3"] : [], shell: isWin && cmd !== "py" };
}

function resolvePip(projectRoot) {
  const pip = venvPipPath(projectRoot);
  if (fs.existsSync(pip)) return { command: pip, argsPrefix: [], shell: false };
  const { command, argsPrefix } = resolvePython(projectRoot);
  return { command, argsPrefix: [...argsPrefix, "-m", "pip"], shell: false };
}

function run(command, args, options = {}) {
  const shell = options.shell ?? false;
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    stdio: "inherit",
    shell,
    env: options.env ?? process.env,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/** Run npm via the same npm that invoked this script (works in PowerShell, cmd, bash, zsh). */
function runNpm(npmArgs, cwd) {
  const execPath = process.env.npm_execpath;
  if (execPath) {
    run(process.execPath, [execPath, ...npmArgs], { cwd, shell: false });
    return;
  }
  run(isWin ? "npm.cmd" : "npm", npmArgs, { cwd, shell: isWin });
}

module.exports = {
  isWin,
  venvPythonPath,
  venvPipPath,
  systemPythonCommand,
  systemPythonArgs,
  resolvePython,
  resolvePip,
  run,
  runNpm,
};
