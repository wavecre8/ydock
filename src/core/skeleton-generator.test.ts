import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SkeletonGenerator } from './skeleton-generator';
import * as yaml from 'js-yaml';
import { DocDockConstants } from './constants';

describe('SkeletonGenerator', () => {
    const testDir = path.join(__dirname, '__test_skeleton_tmp__');
    const configPath = path.join(testDir, 'setting.config.yml');
    const sourceDir = path.join(testDir, 'sources');
    const aliasDir = path.join(testDir, 'aliases');
    const guideDir = path.join(testDir, 'guides');
    const excludeDir = path.join(testDir, 'excludes');

    beforeAll(() => {
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
        if (!fs.existsSync(sourceDir)) fs.mkdirSync(sourceDir, { recursive: true });
        if (!fs.existsSync(aliasDir)) fs.mkdirSync(aliasDir, { recursive: true });
        if (!fs.existsSync(guideDir)) fs.mkdirSync(guideDir, { recursive: true });
        if (!fs.existsSync(excludeDir)) fs.mkdirSync(excludeDir, { recursive: true });

        // Create a dummy source
        const dummySource = {
            tasks: [
                {
                    taskArn: "arn:aws:ecs...",
                    containers: [
                        { name: "web", image: "nginx" }
                    ]
                }
            ]
        };
        fs.writeFileSync(path.join(sourceDir, 'dummy.yml'), yaml.dump(dummySource));

        // Create setting config
        const config = {
            pages: [
                {
                    title: "Test Page",
                    sources: ["sources/dummy.yml"],
                    aliasDir: "aliases",
                    guideDir: "guides",
                    excludeDir: "excludes",
                    output: "output/test.html"
                }
            ]
        };
        fs.writeFileSync(configPath, yaml.dump(config));
    });

    afterAll(() => {
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should generate a new skeleton alias file if it does not exist', async () => {
        const generatedAliasPath = path.join(aliasDir, `dummy${DocDockConstants.FileSuffixes.AliasYml}`);
        if (fs.existsSync(generatedAliasPath)) fs.unlinkSync(generatedAliasPath);

        await SkeletonGenerator.generate({ configPath, type: 'alias', silent: true });

        expect(fs.existsSync(generatedAliasPath)).toBe(true);

        const content = fs.readFileSync(generatedAliasPath, 'utf8');
        expect(content).toContain('"tasks": ""');
        expect(content).toContain('"tasks[].taskArn": ""');
        expect(content).toContain('"tasks[].containers": ""');
        expect(content).toContain('"tasks[].containers[].name": ""');
    });

    it('should append missing keys to an existing alias file, preserving [=xxxxx]', async () => {
        const existingAliasPath = path.join(aliasDir, `dummy${DocDockConstants.FileSuffixes.AliasYml}`);
        fs.writeFileSync(existingAliasPath, 
            `"tasks": "タスク一覧"\n"tasks[=taskArn:123]": "特殊タスク"\n`
        );

        await SkeletonGenerator.generate({ configPath, type: 'alias', silent: true });

        const content = fs.readFileSync(existingAliasPath, 'utf8');
        
        expect(content).toContain('"tasks": "タスク一覧"');
        expect(content).toContain('"tasks[=taskArn:123]": "特殊タスク"');
        expect(content).toContain('"tasks[].taskArn": ""');
        expect(content).toContain('"tasks[].containers": ""');
        expect(content).toContain('"tasks[].containers[].name": ""');

        const countTasks = (content.match(/"tasks":/g) || []).length;
        expect(countTasks).toBe(1);
    });

    it('should generate a new skeleton exclude file with false values', async () => {
        const generatedExcludePath = path.join(excludeDir, `dummy${DocDockConstants.FileSuffixes.ExcludeYml}`);
        if (fs.existsSync(generatedExcludePath)) fs.unlinkSync(generatedExcludePath);

        await SkeletonGenerator.generate({ configPath, type: 'exclude', silent: true });

        expect(fs.existsSync(generatedExcludePath)).toBe(true);

        const content = fs.readFileSync(generatedExcludePath, 'utf8');
        expect(content).toContain('"tasks": false');
        expect(content).toContain('"tasks[].taskArn": false');
        expect(content).toContain('"tasks[].containers[].name": false');
    });

    it('should append missing keys to an existing exclude file as false', async () => {
        const existingExcludePath = path.join(excludeDir, `dummy${DocDockConstants.FileSuffixes.ExcludeYml}`);
        fs.writeFileSync(existingExcludePath, 
            `"tasks": true\n`
        );

        await SkeletonGenerator.generate({ configPath, type: 'exclude', silent: true });

        const content = fs.readFileSync(existingExcludePath, 'utf8');
        
        expect(content).toContain('"tasks": true');
        expect(content).toContain('"tasks[].taskArn": false');
        expect(content).toContain('"tasks[].containers[].name": false');
    });

    it('should generate a nested skeleton guide file with condition matchers', async () => {
        const generatedGuidePath = path.join(guideDir, `dummy${DocDockConstants.FileSuffixes.GuideYml}`);
        if (fs.existsSync(generatedGuidePath)) fs.unlinkSync(generatedGuidePath);

        await SkeletonGenerator.generate({ configPath, type: 'guide', silent: true });

        expect(fs.existsSync(generatedGuidePath)).toBe(true);

        const content = fs.readFileSync(generatedGuidePath, 'utf8');
        const doc = yaml.load(content) as any;

        expect(doc.tasks).toBeInstanceOf(Array);
        expect(doc.tasks[0]).toHaveProperty('=taskArn', 'arn:aws:ecs...');
        expect(doc.tasks[0].taskArn).toBe('');
        expect(doc.tasks[0].containers).toBeInstanceOf(Array);
        expect(doc.tasks[0].containers[0]).toHaveProperty('=name', 'web');
        expect(doc.tasks[0].containers[0].name).toBe('');
        expect(doc.tasks[0].containers[0].image).toBe('');
    });

    it('should merge missing keys with an existing guide file, preserving descriptions', async () => {
        const existingGuidePath = path.join(guideDir, `dummy${DocDockConstants.FileSuffixes.GuideYml}`);
        const existingGuide = {
            tasks: [
                {
                    '=taskArn': 'arn:aws:ecs...',
                    taskArn: 'タスクARNの説明',
                    containers: [
                        {
                            '=name': 'web',
                            name: 'コンテナ名の説明'
                        }
                    ]
                }
            ]
        };
        fs.writeFileSync(existingGuidePath, yaml.dump(existingGuide));

        await SkeletonGenerator.generate({ configPath, type: 'guide', silent: true });

        const content = fs.readFileSync(existingGuidePath, 'utf8');
        const doc = yaml.load(content) as any;

        expect(doc.tasks[0].taskArn).toBe('タスクARNの説明');
        expect(doc.tasks[0].containers[0].name).toBe('コンテナ名の説明');
        expect(doc.tasks[0].containers[0].image).toBe('');
    });

    it('should generate all types by default', async () => {
        const generatedAliasPath = path.join(aliasDir, `dummy${DocDockConstants.FileSuffixes.AliasYml}`);
        const generatedGuidePath = path.join(guideDir, `dummy${DocDockConstants.FileSuffixes.GuideYml}`);
        const generatedExcludePath = path.join(excludeDir, `dummy${DocDockConstants.FileSuffixes.ExcludeYml}`);

        if (fs.existsSync(generatedAliasPath)) fs.unlinkSync(generatedAliasPath);
        if (fs.existsSync(generatedGuidePath)) fs.unlinkSync(generatedGuidePath);
        if (fs.existsSync(generatedExcludePath)) fs.unlinkSync(generatedExcludePath);

        await SkeletonGenerator.generate({ configPath, silent: true });

        expect(fs.existsSync(generatedAliasPath)).toBe(true);
        expect(fs.existsSync(generatedGuidePath)).toBe(true);
        expect(fs.existsSync(generatedExcludePath)).toBe(true);
    });
});
