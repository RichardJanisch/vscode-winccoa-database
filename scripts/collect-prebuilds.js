#!/usr/bin/env node
'use strict';

/**
 * Collects better-sqlite3 native binaries for both Node.js and Electron runtimes.
 *
 * Usage:
 *   node scripts/collect-prebuilds.js --node                 # collect the current Node.js build
 *   node scripts/collect-prebuilds.js --electron             # collect the current Electron build
 *   node scripts/collect-prebuilds.js --download-node 20.0.0 22.0.0
 *       Download portable prebuilds from GitHub releases for each Node version.
 *       These binaries are built on old glibc (≤ 2.29) and work across distros.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(
    ROOT,
    'node_modules',
    'better-sqlite3',
    'build',
    'Release',
    'better_sqlite3.node',
);

// Parse --platform and --arch flags (defaults to current host)
let targetPlatform = process.platform;
let targetArch = process.arch;
const rawArgs = process.argv.slice(2);
const args = [];
for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === '--platform' && i + 1 < rawArgs.length) {
        targetPlatform = rawArgs[++i];
    } else if (rawArgs[i] === '--arch' && i + 1 < rawArgs.length) {
        targetArch = rawArgs[++i];
    } else {
        args.push(rawArgs[i]);
    }
}

const PREBUILDS_DIR = path.join(ROOT, 'prebuilds', `${targetPlatform}-${targetArch}`);

const mode = args[0];
if (mode !== '--node' && mode !== '--electron' && mode !== '--download-node') {
    console.error(
        'Usage: node scripts/collect-prebuilds.js [--platform <p>] [--arch <a>] --node|--electron|--download-node <versions...>',
    );
    process.exit(1);
}

fs.mkdirSync(PREBUILDS_DIR, { recursive: true });

// ── Download prebuilds from GitHub releases ────────────────────────
if (mode === '--download-node') {
    const versions = args.slice(1);
    if (versions.length === 0) {
        console.error('Provide at least one Node target version (e.g. 20.0.0 22.0.0)');
        process.exit(1);
    }

    // Node major -> ABI mapping
    const nodeAbiMap = { 18: '108', 20: '115', 22: '127', 23: '131' };

    for (const ver of versions) {
        const major = parseInt(ver.split('.')[0], 10);
        const abi = nodeAbiMap[major];
        if (!abi) {
            console.error(`Unknown Node major version: ${major}`);
            process.exit(1);
        }

        console.log(`Downloading prebuild for Node ${ver} (ABI ${abi})...`);
        const cwd = path.join(ROOT, 'node_modules', 'better-sqlite3');
        execFileSync(
            process.execPath,
            [
                require.resolve('prebuild-install/bin'),
                '--runtime',
                'node',
                '--target',
                ver,
                '--arch',
                targetArch,
                '--platform',
                targetPlatform,
                '--force',
            ],
            { cwd, stdio: 'inherit' },
        );

        if (!fs.existsSync(SOURCE)) {
            console.error(`prebuild-install did not produce ${SOURCE}`);
            process.exit(1);
        }

        const dest = path.join(PREBUILDS_DIR, `better_sqlite3_${abi}.node`);
        fs.copyFileSync(SOURCE, dest);
        console.log(`Collected: ${dest}`);
    }

    // Clean up dev dependencies that prebuild-install may have pulled into
    // better-sqlite3/node_modules/ — vsce package rejects extraneous deps.
    const nestedModules = path.join(ROOT, 'node_modules', 'better-sqlite3', 'node_modules');
    if (fs.existsSync(nestedModules)) {
        fs.rmSync(nestedModules, { recursive: true, force: true });
        console.log('Cleaned up nested node_modules from prebuild-install.');
    }

    process.exit(0);
}

// ── Collect from local build ───────────────────────────────────────
if (!fs.existsSync(SOURCE)) {
    console.error(`Source not found: ${SOURCE}`);
    process.exit(1);
}

const abi = process.versions.modules;

let targetAbi;
if (mode === '--node') {
    targetAbi = abi;
    console.log(`Collecting Node.js prebuild (ABI ${targetAbi})`);
} else {
    // Read the Electron version from package.json rebuild script
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
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
        32: '128',
        33: '130',
        34: '132',
        35: '133',
        36: '135',
        37: '136',
        38: '139',
        39: '140',
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
