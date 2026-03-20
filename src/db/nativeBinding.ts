import * as path from 'path';
import * as fs from 'fs';

/**
 * Resolves the correct better-sqlite3 native binding for the current runtime.
 *
 * VS Code extensions run in two different runtimes:
 *   - Local VS Code: Electron (e.g. ABI 140 for Electron 39)
 *   - Remote SSH / Docker: plain Node.js (e.g. ABI 127 for Node 22)
 *
 * We ship prebuilt .node binaries for both runtimes and select the right one
 * based on process.versions.modules (the current ABI version).
 */
export function resolveNativeBinding(): string | undefined {
  const abi = process.versions.modules;
  const platform = process.platform;
  const arch = process.arch;

  // Look for a matching prebuild shipped alongside the extension
  const prebuildsDir = path.join(__dirname, '..', 'prebuilds', `${platform}-${arch}`);
  const candidates = [
    path.join(prebuildsDir, `better_sqlite3_${abi}.node`),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback: let better-sqlite3 resolve its own binding (default behavior)
  return undefined;
}
