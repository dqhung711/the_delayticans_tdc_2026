#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { runNpm } = require("./lib/platform.cjs");

const frontendDir = path.join(path.resolve(__dirname, ".."), "frontend");
runNpm(["install"], frontendDir);
