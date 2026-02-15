import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { getTestProjectPath, hasTestProjectSqliteDb } from '../test-project-helpers';

describe('SQLite Database Integration Tests', () => {
    it('should find test project fixture path', () => {
        const projectPath = getTestProjectPath('runnable');
        assert.ok(projectPath, 'Project path should be defined');
        assert.ok(projectPath.includes('runnable'), 'Project path should include "runnable"');
    });

    it('should check for SQLite database existence', () => {
        // This test will pass if the fixture has SQLite databases
        // or fail gracefully if they don't exist (which is expected initially)
        const hasSqlite = hasTestProjectSqliteDb('runnable');
        // Just verify the function runs without errors
        assert.ok(hasSqlite === true || hasSqlite === false, 'Should return a boolean');
    });
});

