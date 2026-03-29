import path from 'path';
import fs from 'fs';

/**
 * Gets the absolute path to the test fixtures directory.
 * Resolves from dist/test/ up to the workspace root then into src/test/fixtures/.
 * The sqlite databases are generated into this directory by `npm run test:fixtures`.
 */
export function getFixturesPath(): string {
    return path.resolve(__dirname, '..', '..', 'src', 'test', 'fixtures');
}

/**
 * Gets the absolute path to a test project fixture
 * @param projectName Name of the test project (e.g., 'runnable', 'sub-proj')
 */
export function getTestProjectPath(projectName: string): string {
    return path.join(getFixturesPath(), 'projects', projectName);
}

/**
 * Checks if a test project has the required SQLite database files
 * @param projectName Name of the test project
 * @returns true if the SQLite databases exist
 */
export function hasTestProjectSqliteDb(projectName: string): boolean {
    const projectPath = getTestProjectPath(projectName);
    const sqliteDir = path.join(projectPath, 'db', 'wincc_oa', 'sqlite');
    const identPath = path.join(sqliteDir, 'ident.sqlite');
    return fs.existsSync(identPath);
}
