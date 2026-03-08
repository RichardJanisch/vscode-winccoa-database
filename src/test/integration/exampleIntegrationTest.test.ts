import * as assert from 'assert';
import { getTestProjectPath, hasTestProjectSqliteDb } from '../test-project-helpers';

suite('SQLite Database Integration Tests', () => {
    test('should find test project fixture path', () => {
        const projectPath = getTestProjectPath('runnable');
        assert.ok(projectPath, 'Project path should be defined');
        assert.ok(projectPath.includes('runnable'), 'Project path should include "runnable"');
    });

    test('should check for SQLite database existence', () => {
        // This test will pass if the fixture has SQLite databases
        // or fail gracefully if they don't exist (which is expected initially)
        const hasSqlite = hasTestProjectSqliteDb('runnable');
        // Just verify the function runs without errors
        assert.ok(hasSqlite === true || hasSqlite === false, 'Should return a boolean');
    });

    test('SQLite fixture databases should exist (run npm run test:fixtures if missing)', () => {
        const hasSqlite = hasTestProjectSqliteDb('runnable');
        assert.strictEqual(
            hasSqlite,
            true,
            'SQLite fixtures not found. Run: npm run test:fixtures'
        );
    });
});

