#!/usr/bin/env node
'use strict';

/**
 * Collects better-sqlite3 native binaries for both Node.js and Electron runtimes.
 *
 * Run this after `npm ci` (Node prebuild) and `npm run rebuild` (Electron prebuild)
 * to gather both .node files into a prebuilds/ directory for packaging.
 *
 * Usage:
 *   node scripts/collect-prebuilds.js --node     # collect the current Node.js build
 *   node scripts/collect-prebuilds.js --electron  # collect the current Electron build
 */

const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
const PREBUILDS_DIR = path.join(__dirname, '..', 'prebuilds', `${process.platform}-${process.arch}`);

const mode = process.argv[2];
if (mode !== '--node' && mode !== '--electron') {
  console.error('Usage: node scripts/collect-prebuilds.js --node|--electron');
  process.exit(1);
}

if (!fs.existsSync(SOURCE)) {
  console.error(`Source not found: ${SOURCE}`);
  process.exit(1);
}

fs.mkdirSync(PREBUILDS_DIR, { recursive: true });

// Determine the ABI of the built binary
// For --node: it matches the current process.versions.modules
// For --electron: we read it from the rebuilt binary (same process since electron-rebuild targets Electron ABI)
const abi = process.versions.modules;

// When called with --electron, the .node file was built for the Electron ABI.
// We need to know that ABI. electron-rebuild writes for the target Electron version.
// We parse it from the rebuild script in package.json.
let targetAbi;
if (mode === '--node') {
  targetAbi = abi;
  console.log(`Collecting Node.js prebuild (ABI ${targetAbi})`);
} else {
  // Read the Electron version from package.json rebuild script
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const rebuildScript = pkg.scripts.rebuild || '';
  const electronVersionMatch = rebuildScript.match(/-v\s+([\d.]+)/);
  if (!electronVersionMatch) {
    console.error('Could not parse Electron version from rebuild script');
    process.exit(1);
  }
  const electronVersion = electronVersionMatch[1];
  const electronMajor = parseInt(electronVersion.split('.')[0], 10);

  // Electron major -> ABI mapping (update when targeting new Electron versions)
  const electronAbiMap = {
    32: '128', 33: '130', 34: '132', 35: '133',
    36: '135', 37: '136', 38: '139', 39: '140',
  };
  targetAbi = electronAbiMap[electronMajor];
  if (!targetAbi) {
    console.error(`Unknown Electron major version: ${electronMajor}`);
    process.exit(1);
  }
  console.log(`Collecting Electron ${electronVersion} prebuild (ABI ${targetAbi})`);
}

const dest = path.join(PREBUILDS_DIR, `better_sqlite3_${targetAbi}.node`);
fs.copyFileSync(SOURCE, dest);
console.log(`Copied: ${dest}`);
