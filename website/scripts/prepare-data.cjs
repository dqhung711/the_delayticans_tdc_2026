#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const projectRoot = path.resolve(__dirname, "..");
const dbPath = path.join(projectRoot, "data", "delays.db");
const gzPath = path.join(projectRoot, "data", "delays.db.gz");

if (fs.existsSync(dbPath)) {
  console.log("data/delays.db already exists; skipping decompression.");
  process.exit(0);
}

if (!fs.existsSync(gzPath)) {
  console.error("Missing data/delays.db.gz and data/delays.db is not present.");
  process.exit(1);
}

const readStream = fs.createReadStream(gzPath);
const gunzip = zlib.createGunzip();
const writeStream = fs.createWriteStream(dbPath);

readStream.on("error", (err) => {
  console.error(`Failed reading ${gzPath}: ${err.message}`);
  process.exit(1);
});

gunzip.on("error", (err) => {
  console.error(`Failed decompressing ${gzPath}: ${err.message}`);
  process.exit(1);
});

writeStream.on("error", (err) => {
  console.error(`Failed writing ${dbPath}: ${err.message}`);
  process.exit(1);
});

writeStream.on("finish", () => {
  console.log("Created data/delays.db from data/delays.db.gz");
});

readStream.pipe(gunzip).pipe(writeStream);
