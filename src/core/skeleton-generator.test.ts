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
                    taskArn: 'arn:aws:ecs...',
                    containers: [{ name: 'web', image: 'nginx' }]
                }
            ]
        };
        fs.writeFileSync(path.join(sourceDir, 'dummy.yml'), yaml.dump(dummySource));

        // Create setting config
        const config = {
            pages: [
                {
                    title: 'Test Page',
                    sources: ['sources/dummy.yml'],
                    aliasDir: 'aliases',
                    guideDir: 'guides',
                    excludeDir: 'excludes',
                    output: 'output/test.html'
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
        fs.writeFileSync(existingAliasPath, `"tasks": "タスク一覧"\n"tasks[=taskArn:123]": "特殊タスク"\n`);

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

    it('should not append duplicate keys when condition matcher key already exists in alias file', async () => {
        const existingAliasPath = path.join(aliasDir, `dummy${DocDockConstants.FileSuffixes.AliasYml}`);
        // 条件指定付きキーを含む既存エイリアスファイルの生成
        fs.writeFileSync(existingAliasPath, `"tasks[=taskArn:123].taskArn": "特殊タスクARN"\n`);

        // エイリアススケルトン生成処理の実行
        await SkeletonGenerator.generate({ configPath, type: 'alias', silent: true });

        // ファイル内容の読み込み検証
        const content = fs.readFileSync(existingAliasPath, 'utf8');

        expect(content).toContain('"tasks[=taskArn:123].taskArn": "特殊タスクARN"');
        expect(content).not.toContain('"tasks[].taskArn": ""');
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

    it('should skip appending child keys if parent key is already true in exclude file', async () => {
        const existingExcludePath = path.join(excludeDir, `dummy${DocDockConstants.FileSuffixes.ExcludeYml}`);
        fs.writeFileSync(existingExcludePath, `"tasks[].containers": true\n`);

        await SkeletonGenerator.generate({ configPath, type: 'exclude', silent: true });

        const content = fs.readFileSync(existingExcludePath, 'utf8');

        expect(content).toContain('"tasks[].containers": true');
        expect(content).toContain('"tasks": false');
        expect(content).toContain('"tasks[].taskArn": false');
        expect(content).not.toContain('"tasks[].containers[].name"');
        expect(content).not.toContain('"tasks[].containers[].image"');
    });

    it('should append child keys if parent key is false in exclude file', async () => {
        const existingExcludePath = path.join(excludeDir, `dummy${DocDockConstants.FileSuffixes.ExcludeYml}`);
        fs.writeFileSync(existingExcludePath, `"tasks": false\n`);

        await SkeletonGenerator.generate({ configPath, type: 'exclude', silent: true });

        const content = fs.readFileSync(existingExcludePath, 'utf8');

        expect(content).toContain('"tasks": false');
        expect(content).toContain('"tasks[].taskArn": false');
        expect(content).toContain('"tasks[].containers": false');
        expect(content).toContain('"tasks[].containers[].name": false');
    });

    it('should not append duplicate keys when condition matcher key already exists in exclude file', async () => {
        const existingExcludePath = path.join(excludeDir, `dummy${DocDockConstants.FileSuffixes.ExcludeYml}`);
        // 条件指定付きキーを含む既存Excludeファイルの生成
        fs.writeFileSync(existingExcludePath, `"tasks[=taskArn:123].taskArn": false\n`);

        // Excludeスケルトン生成処理の実行
        await SkeletonGenerator.generate({ configPath, type: 'exclude', silent: true });

        // ファイル内容の読み込み検証
        const content = fs.readFileSync(existingExcludePath, 'utf8');

        expect(content).toContain('"tasks[=taskArn:123].taskArn": false');
        expect(content).not.toContain('"tasks[].taskArn": false');
    });

    it('should generate a nested skeleton guide file with condition matchers', async () => {
        const generatedGuidePath = path.join(guideDir, `dummy${DocDockConstants.FileSuffixes.GuideYml}`);
        if (fs.existsSync(generatedGuidePath)) fs.unlinkSync(generatedGuidePath);

        await SkeletonGenerator.generate({ configPath, type: 'guide', silent: true });

        expect(fs.existsSync(generatedGuidePath)).toBe(true);

        const content = fs.readFileSync(generatedGuidePath, 'utf8');
        const doc = yaml.load(content) as any;

        expect(doc.tasks).toBeInstanceOf(Array);
        expect(doc.tasks[0]).toHaveProperty('[taskArn=arn:aws:ecs...]');
        expect(doc.tasks[0].taskArn).toBe('');
        expect(doc.tasks[0].containers).toBeInstanceOf(Array);
        expect(doc.tasks[0].containers[0]).toHaveProperty('[name=web]');
        expect(doc.tasks[0].containers[0].name).toBe('');
        expect(doc.tasks[0].containers[0].image).toBe('');
    });

    it('should merge missing keys with an existing guide file, preserving descriptions', async () => {
        const existingGuidePath = path.join(guideDir, `dummy${DocDockConstants.FileSuffixes.GuideYml}`);
        const existingGuide = {
            tasks: [
                {
                    '[taskArn=arn:aws:ecs...]': '',
                    taskArn: 'タスクARNの説明',
                    containers: [
                        {
                            '[name=web]': '',
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

    it('should not duplicate scalar array elements when merging existing guide', async () => {
        const scalarSourcePath = path.join(sourceDir, 'scalar.yml');
        const scalarSource = {
            transforms: ['AWS::LanguageExtensions', 'AWS::Serverless-2016-10-31']
        };
        // スカラー配列テンプレートの作成
        fs.writeFileSync(scalarSourcePath, yaml.dump(scalarSource));

        const scalarConfigPath = path.join(testDir, 'scalar.config.yml');
        const scalarConfig = {
            pages: [
                {
                    title: 'Scalar Test Page',
                    sources: ['sources/scalar.yml'],
                    guideDir: 'guides',
                    output: 'output/scalar.html'
                }
            ]
        };
        // スカラー配列設定ファイルの保存
        fs.writeFileSync(scalarConfigPath, yaml.dump(scalarConfig));

        const existingGuidePath = path.join(guideDir, `scalar${DocDockConstants.FileSuffixes.GuideYml}`);
        const existingGuide = {
            transforms: [
                {
                    '[AWS::LanguageExtensions]': '言語拡張の説明'
                },
                {
                    '[AWS::Serverless-2016-10-31]': 'SAM拡張の説明'
                }
            ]
        };
        // 既存ガイドファイルの保存
        fs.writeFileSync(existingGuidePath, yaml.dump(existingGuide));

        // スケルトン生成処理の実行
        await SkeletonGenerator.generate({ configPath: scalarConfigPath, type: 'guide', silent: true });

        // ガイド生成結果の検証
        const content = fs.readFileSync(existingGuidePath, 'utf8');
        const doc = yaml.load(content) as any;

        expect(doc.transforms).toHaveLength(2);
        expect(doc.transforms[0]['[AWS::LanguageExtensions]']).toBe('言語拡張の説明');
        expect(doc.transforms[1]['[AWS::Serverless-2016-10-31]']).toBe('SAM拡張の説明');
    });

    it('should not duplicate elements with structured condition object when merging existing guide', async () => {
        const ruleSourcePath = path.join(sourceDir, 'rules.yml');
        const ruleSource = {
            assertions: [
                {
                    Assert: {
                        FnEquals: ['prod', 'stg']
                    },
                    AssertDescription: '環境一致検証'
                }
            ]
        };
        // 構造化条件を含むテンプレートの作成
        fs.writeFileSync(ruleSourcePath, yaml.dump(ruleSource));

        const ruleConfigPath = path.join(testDir, 'rules.config.yml');
        const ruleConfig = {
            pages: [
                {
                    title: 'Rule Test Page',
                    sources: ['sources/rules.yml'],
                    guideDir: 'guides',
                    output: 'output/rules.html'
                }
            ]
        };
        // 構造化条件設定ファイルの保存
        fs.writeFileSync(ruleConfigPath, yaml.dump(ruleConfig));

        const existingGuidePath = path.join(guideDir, `rules${DocDockConstants.FileSuffixes.GuideYml}`);
        const existingGuide = {
            assertions: [
                {
                    '[Assert={"FnEquals":["prod","stg"]}]': '',
                    Assert: 'アサーション条件の説明',
                    AssertDescription: '説明文の説明'
                }
            ]
        };
        // 既存ガイドファイルの保存
        fs.writeFileSync(existingGuidePath, yaml.dump(existingGuide));

        // スケルトン生成処理の実行
        await SkeletonGenerator.generate({ configPath: ruleConfigPath, type: 'guide', silent: true });

        // ガイド生成結果の検証
        const content = fs.readFileSync(existingGuidePath, 'utf8');
        const doc = yaml.load(content) as any;

        expect(doc.assertions).toHaveLength(1);
        expect(doc.assertions[0].Assert).toBe('アサーション条件の説明');
        expect(doc.assertions[0].AssertDescription).toBe('説明文の説明');
    });

    it('should fallback to global directory settings when page directory settings are omitted', async () => {
        const customAliasDir = path.join(testDir, 'custom_aliases');
        const customGuideDir = path.join(testDir, 'custom_guides');
        const customExcludeDir = path.join(testDir, 'custom_excludes');

        const globalConfigPath = path.join(testDir, 'global_setting.config.yml');
        const globalConfig = {
            guideDir: 'custom_guides',
            aliasDir: 'custom_aliases',
            excludeDir: 'custom_excludes',
            pages: [
                {
                    title: 'Global Dir Test Page',
                    sources: ['sources/dummy.yml'],
                    output: 'output/global_test.html'
                }
            ]
        };
        // グローバルディレクトリ設定を含むコンフィグの保存
        fs.writeFileSync(globalConfigPath, yaml.dump(globalConfig));

        // スケルトン生成の実行
        await SkeletonGenerator.generate({ configPath: globalConfigPath, type: 'all', silent: true });

        // グローバル指定ディレクトリへの出力検証
        const expectedAliasPath = path.join(customAliasDir, `dummy${DocDockConstants.FileSuffixes.AliasYml}`);
        const expectedGuidePath = path.join(customGuideDir, `dummy${DocDockConstants.FileSuffixes.GuideYml}`);
        const expectedExcludePath = path.join(customExcludeDir, `dummy${DocDockConstants.FileSuffixes.ExcludeYml}`);

        expect(fs.existsSync(expectedAliasPath)).toBe(true);
        expect(fs.existsSync(expectedGuidePath)).toBe(true);
        expect(fs.existsSync(expectedExcludePath)).toBe(true);
    });

    it('should distinguish guide items when condition key count does not match', async () => {
        const multiConditionSourcePath = path.join(sourceDir, 'multi.yml');
        const multiConditionSource = {
            items: [
                {
                    type: 'A',
                    name: 'single'
                }
            ]
        };
        // 単一条件テンプレートの作成
        fs.writeFileSync(multiConditionSourcePath, yaml.dump(multiConditionSource));

        const multiConfigPath = path.join(testDir, 'multi.config.yml');
        const multiConfig = {
            pages: [
                {
                    title: 'Multi Condition Test',
                    sources: ['sources/multi.yml'],
                    guideDir: 'guides',
                    output: 'output/multi.html'
                }
            ]
        };
        fs.writeFileSync(multiConfigPath, yaml.dump(multiConfig));

        const existingGuidePath = path.join(guideDir, `multi${DocDockConstants.FileSuffixes.GuideYml}`);
        const existingGuide = {
            items: [
                {
                    '[type=A]': '',
                    '[name=composite]': '',
                    type: '複合条件の種別説明',
                    name: '複合条件の名前説明'
                }
            ]
        };
        // 既存複合条件ガイドファイルの保存
        fs.writeFileSync(existingGuidePath, yaml.dump(existingGuide));

        // スケルトン生成処理の実行
        await SkeletonGenerator.generate({ configPath: multiConfigPath, type: 'guide', silent: true });

        // ガイド生成結果の検証
        const content = fs.readFileSync(existingGuidePath, 'utf8');
        const doc = yaml.load(content) as any;

        // 条件キー総数不一致により別要素として追加されることの検証
        expect(doc.items).toHaveLength(2);
        expect(doc.items[0]['[name=composite]']).toBe('');
        expect(doc.items[1]['[name=single]']).toBe('');
    });

    it('should throw Error when invalid skeleton type is passed', async () => {
        // 不正なスケルトン種別の例外送出検証
        await expect(
            SkeletonGenerator.generate({ configPath, type: 'invalid_type' as any, silent: true })
        ).rejects.toThrow(/Invalid skeleton type/);
    });

    it('should extract flat key for primitive arrays', async () => {
        const primitiveArraySource = {
            scalarList: ['alpha', 'beta'],
            emptyList: []
        };
        const primSourcePath = path.join(sourceDir, 'prim.yml');
        fs.writeFileSync(primSourcePath, yaml.dump(primitiveArraySource));

        const primConfig = {
            pages: [
                {
                    title: 'Primitive Array Page',
                    sources: ['sources/prim.yml'],
                    aliasDir: 'aliases',
                    output: 'output/prim.html'
                }
            ]
        };
        const primConfigPath = path.join(testDir, 'prim.config.yml');
        fs.writeFileSync(primConfigPath, yaml.dump(primConfig));

        // エイリアススケルトン生成の実行
        await SkeletonGenerator.generate({ configPath: primConfigPath, type: 'alias', silent: true });

        const primAliasPath = path.join(aliasDir, `prim${DocDockConstants.FileSuffixes.AliasYml}`);
        const content = fs.readFileSync(primAliasPath, 'utf8');

        // スカラー配列および空配列の角括弧付きキー抽出検証
        expect(content).toContain('"scalarList[]": ""');
        expect(content).toContain('"emptyList[]": ""');
    });

    it('should parse existing guide containing cfn intrinsic tags without crashing', async () => {
        const cfnSource = {
            Resources: {
                MyBucket: {
                    Type: 'AWS::S3::Bucket'
                }
            }
        };
        const cfnSourcePath = path.join(sourceDir, 'cfn_dummy.yml');
        fs.writeFileSync(cfnSourcePath, yaml.dump(cfnSource));

        const existingGuidePath = path.join(guideDir, `cfn_dummy${DocDockConstants.FileSuffixes.GuideYml}`);
        fs.writeFileSync(existingGuidePath, 'Resources:\n  MyBucket:\n    Description: !Ref SomeOtherResource\n');

        const cfnConfig = {
            pages: [
                {
                    title: 'CFn Page',
                    mode: 'cfn',
                    sources: ['sources/cfn_dummy.yml'],
                    guideDir: 'guides',
                    output: 'output/cfn.html'
                }
            ]
        };
        const cfnConfigPath = path.join(testDir, 'cfn.config.yml');
        fs.writeFileSync(cfnConfigPath, yaml.dump(cfnConfig));

        // CFnモードでのガイドスケルトンマージ実行
        await expect(
            SkeletonGenerator.generate({ configPath: cfnConfigPath, type: 'guide', silent: true })
        ).resolves.not.toThrow();

        const mergedContent = fs.readFileSync(existingGuidePath, 'utf8');
        expect(mergedContent).toContain('!Ref');
    });
});
