#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { resolvePython, run } = require("./lib/platform.cjs");

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
const { command, argsPrefix, shell } = resolvePython(projectRoot);

run(command, [...argsPrefix, ...pythonArgs], { cwd, shell });
