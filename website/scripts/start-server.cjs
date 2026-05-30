#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { resolvePython, run } = require("./lib/platform.cjs");

const port = process.env.PORT || "8000";
const projectRoot = path.resolve(__dirname, "..");
const { command, argsPrefix, shell } = resolvePython(projectRoot);

run(
  command,
  [
    ...argsPrefix,
    "-m",
    "uvicorn",
    "main:app",
    "--host",
    "0.0.0.0",
    "--port",
    port,
  ],
  { cwd: path.join(projectRoot, "api"), shell },
);
