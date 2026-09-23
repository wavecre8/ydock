import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Watcher } from './watcher';

describe('Watcher', () => {
    const testDir = path.resolve(__dirname, '__test_watcher__');
    const externalDir = path.resolve(__dirname, '__test_watcher_ext__');

    beforeEach(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        if (!fs.existsSync(externalDir)) {
            fs.mkdirSync(externalDir, { recursive: true });
        }
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        if (fs.existsSync(externalDir)) {
            fs.rmSync(externalDir, { recursive: true, force: true });
        }
    });

    it('should include external imported files in watch paths', () => {
        const externalCommonYaml = path.resolve(externalDir, 'common.guide.yml');
        fs.writeFileSync(externalCommonYaml, 'commonKey: commonValue\n', 'utf8');

        const guidesDir = path.resolve(testDir, 'guides');
        fs.mkdirSync(guidesDir, { recursive: true });

        const relativeCommon = path.relative(guidesDir, externalCommonYaml).replace(/\\/g, '/');

        const mainGuide = path.resolve(guidesDir, 'main.guide.yml');
        fs.writeFileSync(mainGuide, `_imports:\n  - ${relativeCommon}\nmainKey: mainValue\n`, 'utf8');

        const configPath = path.resolve(testDir, 'setting.config.yml');
        fs.writeFileSync(
            configPath,
            `guideDir: guides\npages:\n  - title: Test\n    sources:\n      - src.yml\n    output: out.html\n`,
            'utf8'
        );

        const watchPaths = (Watcher as any).getWatchPaths(configPath) as string[];

        expect(watchPaths).toContain(path.resolve(externalCommonYaml));
    });
});
