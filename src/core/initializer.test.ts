import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Initializer } from './initializer';
import { DocDockConstants } from './constants';

describe('Initializer', () => {
    const testDir = path.resolve(__dirname, '__test_initializer__');
    const origCwd = process.cwd();

    beforeEach(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        process.chdir(testDir);
    });

    afterEach(() => {
        process.chdir(origCwd);
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        vi.restoreAllMocks();
    });

    it('should create setting.config.yml and default directories', async () => {
        await Initializer.init();

        const configPath = path.resolve(testDir, DocDockConstants.Defaults.ConfigFile);
        expect(fs.existsSync(configPath)).toBe(true);

        const guidePath = path.resolve(testDir, DocDockConstants.Defaults.GuideDir);
        const aliasPath = path.resolve(testDir, DocDockConstants.Defaults.AliasDir);
        const excludePath = path.resolve(testDir, DocDockConstants.Defaults.ExcludeDir);

        expect(fs.existsSync(guidePath)).toBe(true);
        expect(fs.existsSync(aliasPath)).toBe(true);
        expect(fs.existsSync(excludePath)).toBe(true);
    });

    it('should not overwrite existing directories or files', async () => {
        const guidePath = path.resolve(testDir, DocDockConstants.Defaults.GuideDir);
        fs.mkdirSync(guidePath, { recursive: true });
        const dummyFile = path.resolve(guidePath, 'existing.txt');
        fs.writeFileSync(dummyFile, 'hello');

        await Initializer.init();

        expect(fs.existsSync(dummyFile)).toBe(true);
        expect(fs.readFileSync(dummyFile, 'utf8')).toBe('hello');
    });
});
