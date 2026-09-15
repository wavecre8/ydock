import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { DefinitionLoader } from './definition-loader';
import { DocDockConstants } from './constants';

describe('DefinitionLoader', () => {
    const testDir = path.resolve(__dirname, '../../test_temp_def_loader');

    beforeEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        fs.mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('findDefinitionFile', () => {
        it('相対パス構造を維持したディレクトリ階層から定義ファイルを検出する', () => {
            const nestedDir = path.join(testDir, 'sub/nested');
            fs.mkdirSync(nestedDir, { recursive: true });
            const targetFile = path.join(nestedDir, 'template.guide.yml');
            fs.writeFileSync(targetFile, 'Description: test');

            // 相対階層を考慮した探索実行
            const found = DefinitionLoader.findDefinitionFile('sub/nested/template.yml', testDir, [
                DocDockConstants.FileSuffixes.GuideYml
            ]);
            expect(found).toBe(targetFile);
        });

        it('先頭ディレクトリを除去したディレクトリ階層から定義ファイルを検出する', () => {
            const strippedDir = path.join(testDir, 'nested');
            fs.mkdirSync(strippedDir, { recursive: true });
            const targetFile = path.join(strippedDir, 'template.guide.yml');
            fs.writeFileSync(targetFile, 'Description: test');

            // 先頭ディレクトリ除去を考慮した探索実行
            const found = DefinitionLoader.findDefinitionFile('firstLevel/nested/template.yml', testDir, [
                DocDockConstants.FileSuffixes.GuideYml
            ]);
            expect(found).toBe(targetFile);
        });

        it('ルート直下のフラットなディレクトリ階層から定義ファイルを検出する', () => {
            const targetFile = path.join(testDir, 'flat_template.guide.yml');
            fs.writeFileSync(targetFile, 'Description: flat test');

            // 直下探索実行
            const found = DefinitionLoader.findDefinitionFile('sub/dir/flat_template.yml', testDir, [
                DocDockConstants.FileSuffixes.GuideYml
            ]);
            expect(found).toBe(targetFile);
        });

        it('対象ファイルが存在しない場合はnullを返却する', () => {
            // 存在しないファイルの探索実行
            const found = DefinitionLoader.findDefinitionFile('missing.yml', testDir, [
                DocDockConstants.FileSuffixes.GuideYml
            ]);
            expect(found).toBeNull();
        });

        it('Windows形式のバックスラッシュを含む相対パスでも定義ファイルを検出する', () => {
            const nestedDir = path.join(testDir, 'sub/nested');
            fs.mkdirSync(nestedDir, { recursive: true });
            const targetFile = path.join(nestedDir, 'template.guide.yml');
            fs.writeFileSync(targetFile, 'Description: test');

            // バックスラッシュを含むパスによる探索実行
            const found = DefinitionLoader.findDefinitionFile('sub\\nested\\template.yml', testDir, [
                DocDockConstants.FileSuffixes.GuideYml
            ]);
            expect(found).toBe(targetFile);
        });

        it('絶対パス指定時も基準ディレクトリからの相対パスにより定義ファイルを検出する', () => {
            const nestedDir = path.join(testDir, 'sub/nested');
            fs.mkdirSync(nestedDir, { recursive: true });
            const targetFile = path.join(nestedDir, 'template.guide.yml');
            fs.writeFileSync(targetFile, 'Description: test');

            const baseRootDir = path.join(testDir, 'sources_root');
            const absoluteSource = path.join(baseRootDir, 'sub/nested/template.yml');

            // 絶対パスおよび基準ディレクトリ指定による探索実行
            const found = DefinitionLoader.findDefinitionFile(
                absoluteSource,
                testDir,
                [DocDockConstants.FileSuffixes.GuideYml],
                baseRootDir
            );
            expect(found).toBe(targetFile);
        });
    });

    describe('loadRawWithImports', () => {
        it('存在しないファイルの場合は空オブジェクトを返却する', () => {
            // 存在しないファイルの読み込み実行
            const result = DefinitionLoader.loadRawWithImports(path.join(testDir, 'none.yml'));
            expect(result).toEqual({});
        });

        it('YAMLファイルの内容を読み込みインポートを解決する', () => {
            const importedFile = path.join(testDir, 'imported.yml');
            fs.writeFileSync(importedFile, 'ImportedKey: ImportedValue\n');

            const mainFile = path.join(testDir, 'main.yml');
            fs.writeFileSync(mainFile, '_imports:\n  - imported.yml\nMainKey: MainValue\n');

            // インポート解決を含む読み込み実行
            const result = DefinitionLoader.loadRawWithImports(mainFile);
            expect(result.MainKey).toBe('MainValue');
            expect(result.ImportedKey).toBe('ImportedValue');
        });

        it('非オブジェクト形式のYAMLの場合は空オブジェクトを返却する', () => {
            const scalarFile = path.join(testDir, 'scalar.yml');
            fs.writeFileSync(scalarFile, 'just a string\n');

            // スカラーYAMLの読み込み実行
            const result = DefinitionLoader.loadRawWithImports(scalarFile);
            expect(result).toEqual({});
        });
    });

    describe('loadGuide', () => {
        it('guideDirが未指定の場合はnullを返却する', () => {
            // 未指定時の探索実行
            const result = DefinitionLoader.loadGuide('template.yml', undefined, path.join(testDir, 'config.yml'));
            expect(result).toBeNull();
        });

        it('ガイドファイルを探索してインポート解決済みデータを返却する', () => {
            const guideDir = path.join(testDir, 'guides');
            fs.mkdirSync(guideDir, { recursive: true });
            const guideFile = path.join(guideDir, 'service.guide.yml');
            fs.writeFileSync(guideFile, 'Resources:\n  MyRes:\n    _description: Resource Guide\n');

            const configPath = path.join(testDir, 'setting.config.yml');

            // ガイド読み込み実行
            const result = DefinitionLoader.loadGuide('service.yml', 'guides', configPath, true);
            expect(result).toEqual({
                Resources: {
                    MyRes: {
                        _description: 'Resource Guide'
                    }
                }
            });
        });
    });

    describe('loadAlias', () => {
        it('aliasDirが未指定の場合はnullを返却する', () => {
            // 未指定時の探索実行
            const result = DefinitionLoader.loadAlias('template.yml', undefined, path.join(testDir, 'config.yml'));
            expect(result).toBeNull();
        });

        it('エイリアスファイルを探索してツリー展開およびオブジェクト化済みデータを返却する', () => {
            const aliasDir = path.join(testDir, 'aliases');
            fs.mkdirSync(aliasDir, { recursive: true });
            const aliasFile = path.join(aliasDir, 'service.alias.yml');
            fs.writeFileSync(aliasFile, 'Resources.MyRes.Properties.Key: KeyAlias\n');

            const configPath = path.join(testDir, 'setting.config.yml');

            // エイリアス読み込み実行
            const result = DefinitionLoader.loadAlias('service.yml', 'aliases', configPath, true);
            expect(result).toEqual({
                Resources: {
                    MyRes: {
                        Properties: {
                            Key: {
                                _alias: 'KeyAlias'
                            }
                        }
                    }
                }
            });
        });
    });

    describe('loadExclude', () => {
        it('excludeDirが未指定の場合はnullを返却する', () => {
            // 未指定時の探索実行
            const result = DefinitionLoader.loadExclude('template.yml', undefined, path.join(testDir, 'config.yml'));
            expect(result).toBeNull();
        });

        it('除外定義ファイルを探索してツリー展開済みデータを返却する', () => {
            const excludeDir = path.join(testDir, 'excludes');
            fs.mkdirSync(excludeDir, { recursive: true });
            const excludeFile = path.join(excludeDir, 'service.exclude.yml');
            fs.writeFileSync(excludeFile, 'Resources.SecretRes: true\n');

            const configPath = path.join(testDir, 'setting.config.yml');

            // 除外定義読み込み実行
            const result = DefinitionLoader.loadExclude('service.yml', 'excludes', configPath, true);
            expect(result).toEqual({
                Resources: {
                    SecretRes: {
                        __value: true
                    }
                }
            });
        });
    });

    describe('processAliasFile', () => {
        it('単一エイリアスファイルを直接読み込みツリー展開を行う', () => {
            const aliasFile = path.join(testDir, 'direct.alias.yml');
            fs.writeFileSync(aliasFile, 'Server.Port: PortAlias\n');

            // エイリアスファイル直接処理実行
            const result = DefinitionLoader.processAliasFile(aliasFile);
            expect(result).toEqual({
                Server: {
                    Port: {
                        _alias: 'PortAlias'
                    }
                }
            });
        });

        it('アンダースコアで始まるメタデータキーを保持する', () => {
            const aliasFile = path.join(testDir, 'meta.alias.yml');
            fs.writeFileSync(aliasFile, 'key1:\n  _alias: "Explicit Alias"\n  _description: "Some desc"\n');

            // メタデータキー保持処理の実行
            const result = DefinitionLoader.processAliasFile(aliasFile);
            expect(result).toEqual({
                key1: {
                    _alias: 'Explicit Alias',
                    _description: 'Some desc'
                }
            });
        });

        it('配列フラットパスおよび条件パスを正しくツリー展開する', () => {
            const aliasFile = path.join(testDir, 'flat.alias.yml');
            fs.writeFileSync(aliasFile, '"items[].name": "Item Name"\n"items[id=1].alias": "Alias 1"\n');

            // フラットパス展開の実行
            const result = DefinitionLoader.processAliasFile(aliasFile);
            expect(result).toEqual({
                items: {
                    [DocDockConstants.ReservedKeys.Array]: { name: { _alias: 'Item Name' } },
                    [DocDockConstants.ReservedKeys.Match]: [{ '[id=1]': '1', alias: { _alias: 'Alias 1' } }]
                }
            });
        });

        it('複合条件を共有するパスで独立したマッチャーを維持する', () => {
            const aliasFile = path.join(testDir, 'composite.alias.yml');
            fs.writeFileSync(
                aliasFile,
                '"items[type=A&env=prod].alias": "Prod A"\n"items[type=A&env=dev].alias": "Dev A"\n'
            );

            // 複合条件パス展開の実行
            const result = DefinitionLoader.processAliasFile(aliasFile);
            expect(result).toEqual({
                items: {
                    [DocDockConstants.ReservedKeys.Match]: [
                        { '[type=A]': 'A', '[env=prod]': 'prod', alias: { _alias: 'Prod A' } },
                        { '[type=A]': 'A', '[env=dev]': 'dev', alias: { _alias: 'Dev A' } }
                    ]
                }
            });
        });
    });

    describe('processExcludeFile', () => {
        it('単一除外ファイルを直接読み込みツリー展開を行う', () => {
            const excludeFile = path.join(testDir, 'direct.exclude.yml');
            fs.writeFileSync(excludeFile, 'Database.Password: true\n');

            // 除外定義ファイル直接処理実行
            const result = DefinitionLoader.processExcludeFile(excludeFile);
            expect(result).toEqual({
                Database: {
                    Password: {
                        __value: true
                    }
                }
            });
        });

        it('フラットパスから__valueを持つExcludeTreeを展開する', () => {
            const excludeFile = path.join(testDir, 'complex.exclude.yml');
            fs.writeFileSync(
                excludeFile,
                '"connectivityAt": true\n"containers[].networkInterfaces[].attachmentId": true\n"containers": true\n"containers[].name": false\n'
            );

            // 複合除外パス展開の実行
            const result = DefinitionLoader.processExcludeFile(excludeFile, testDir) as any;
            expect(result.connectivityAt).toBe(true);
            expect(result.containers.__value).toBe(true);
            expect(result.containers['[]'].name.__value).toBe(false);
            expect(result.containers['[]'].networkInterfaces['[]'].attachmentId.__value).toBe(true);
        });

        it('存在しない除外ファイルの場合は空オブジェクトを返却する', () => {
            // 存在しないファイルの処理実行
            const result = DefinitionLoader.processExcludeFile(path.join(testDir, 'none.exclude.yml'));
            expect(result).toEqual({});
        });
    });
});
