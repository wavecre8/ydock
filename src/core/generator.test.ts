import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Generator } from './generator';
import * as fs from 'fs';
import * as ejs from 'ejs';
import { ModeStrategy } from '../modes/types';
import { Logger } from './logger';
import { MarkdownProcessor } from './markdown-processor';

vi.mock('fs');
vi.mock('ejs');

const mockStrategy = {
    getIgnoredSections: vi.fn().mockReturnValue([]),
    getSectionSortOrder: vi.fn().mockReturnValue(undefined),
    isIntrinsic: vi.fn().mockReturnValue(false)
} as unknown as ModeStrategy;

describe('Generator', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should generate HTML with injected CSS and JS', () => {
        vi.mocked(fs.readFileSync).mockImplementation((path) => {
            if (String(path).endsWith('style.css')) return 'BODY { color: red; }';
            if (String(path).endsWith('script.js')) return 'console.log("hi");';
            return '<html>/* INJECT_CSS_PLACEHOLDER */// INJECT_JS_PLACEHOLDER</html>';
        });
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(ejs.render).mockReturnValue('<html>/* INJECT_CSS_PLACEHOLDER */// INJECT_JS_PLACEHOLDER</html>');

        const doc = { template: {}, description: {}, mode: 'generic' as const };

        const html = Generator.generate(doc, 'template.ejs', mockStrategy);

        expect(html).toContain('BODY { color: red; }');
        expect(html).toContain('console.log("hi");');
        expect(html).not.toContain('INJECT_CSS_PLACEHOLDER');
    });

    it('should preserve dollar sign patterns in injected CSS and JS without regex replacement distortion', () => {
        vi.mocked(fs.readFileSync).mockImplementation((path) => {
            if (String(path).endsWith('style.css')) return '.rule { content: "$& $$ $\'"; }';
            if (String(path).endsWith('script.js')) return 'const q = $("div"); const ref = "$` $1";';
            return '<html>/* INJECT_CSS_PLACEHOLDER */// INJECT_JS_PLACEHOLDER</html>';
        });
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(ejs.render).mockReturnValue('<html>/* INJECT_CSS_PLACEHOLDER */// INJECT_JS_PLACEHOLDER</html>');

        const doc = { template: {}, description: {}, mode: 'generic' as const };

        // 特殊置換記号を含むアセット埋め込みの実行
        const html = Generator.generate(doc, 'template.ejs', mockStrategy);

        // 特殊文字パターンの保持検証
        expect(html).toContain('.rule { content: "$& $$ $\'"; }');
        expect(html).toContain('const q = $("div"); const ref = "$` $1";');
    });

    it('should handle missing CSS/JS gracefully', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('<html>/* INJECT_CSS_PLACEHOLDER */</html>');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('<html>/* INJECT_CSS_PLACEHOLDER */</html>');

        const doc = { template: {}, description: {}, mode: 'generic' as const };

        const html = Generator.generate(doc, 'template.ejs', mockStrategy);

        expect(html).toContain('INJECT_CSS_PLACEHOLDER');
    });

    it('should sort sections if order provided', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const localStrategy = {
            ...mockStrategy,
            getIgnoredSections: vi.fn().mockReturnValue([]),
            getSectionSortOrder: vi.fn().mockReturnValue(['First', 'Second'])
        } as unknown as ModeStrategy;

        const doc = {
            template: { Second: {}, First: {} },
            description: {},
            mode: 'generic' as const
        };

        Generator.generate(doc, 't.ejs', localStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        expect(data.renderableSections).toEqual(['First', 'Second']);
    });

    it('should build processedDocuments correctly when multiple documents provided', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const doc = {
            template: {},
            mode: 'generic' as const,
            documents: [
                {
                    sourcePath: 'sources/a.yaml',
                    sourceBaseName: 'a',
                    template: { Tasks: { task1: {} } }
                },
                {
                    sourcePath: 'sources/b.yaml',
                    sourceBaseName: 'b',
                    template: { Tasks: { task2: {} } }
                }
            ]
        };

        // 複数ドキュメント描画処理の実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        expect(data.processedDocuments).toHaveLength(2);
        expect(data.processedDocuments[0].docPrefix).toBe('doc_0');
        expect(data.processedDocuments[1].docPrefix).toBe('doc_1');
        expect(data.processedDocuments[0].renderableSections).toEqual(['Tasks']);
        expect(data.processedDocuments[1].renderableSections).toEqual(['Tasks']);
        // 同一キーにおける自ドキュメント優先接頭辞解決の検証
        expect(data.processedDocuments[0].linkResolver('Tasks')).toBe('doc_0');
        expect(data.processedDocuments[1].linkResolver('Tasks')).toBe('doc_1');
    });

    it('should resolve cross document link prefix using linkResolver', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const doc = {
            template: {},
            mode: 'generic' as const,
            documents: [
                {
                    sourcePath: 'sources/ecs.yaml',
                    sourceBaseName: 'ecs',
                    template: { tasks: {} }
                },
                {
                    sourcePath: 'sources/ec2.yaml',
                    sourceBaseName: 'ec2',
                    template: { Reservations: {} }
                }
            ]
        };

        // 複数ドキュメント生成処理の実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        const ecsDoc = data.processedDocuments[0];
        // 自ドキュメントキーは自接頭辞、他ドキュメントキーは他接頭辞への解決検証
        expect(ecsDoc.linkResolver('tasks')).toBe('doc_0');
        expect(ecsDoc.linkResolver('Reservations')).toBe('doc_1');
    });

    it('should resolve cross document link prefix case insensitively', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const doc = {
            template: {},
            mode: 'generic' as const,
            documents: [
                {
                    sourcePath: 'sources/ecs.yaml',
                    sourceBaseName: 'ecs',
                    template: { Tasks: {} }
                },
                {
                    sourcePath: 'sources/ec2.yaml',
                    sourceBaseName: 'ec2',
                    template: { Reservations: {} }
                }
            ]
        };

        // 大文字小文字の差異を含むリンク解決検証の実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        const ecsDoc = data.processedDocuments[0];
        // 自ドキュメントキーの大文字小文字表記ゆれ解決検証
        expect(ecsDoc.linkResolver('tasks')).toBe('doc_0');
        expect(ecsDoc.linkResolver('TASKS')).toBe('doc_0');
        // 他ドキュメントキーの大文字小文字表記ゆれ解決検証
        expect(ecsDoc.linkResolver('reservations')).toBe('doc_1');
        expect(ecsDoc.linkResolver('RESERVATIONS')).toBe('doc_1');
    });

    it('should include Description section in renderableSections of processedDocuments', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const doc = {
            template: {},
            mode: 'cfn' as const,
            documents: [
                {
                    sourcePath: 'sources/main.yaml',
                    sourceBaseName: 'main',
                    template: {
                        Description: 'Main Template Description',
                        Resources: {}
                    }
                }
            ]
        };

        // 単一ドキュメント生成処理の実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        expect(data.processedDocuments[0].renderableSections).toContain('Description');
    });

    it('should warn when key conflicts across multiple other documents and resolve to first match', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const warnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => {});

        const doc = {
            template: {},
            mode: 'generic' as const,
            documents: [
                {
                    sourcePath: 'sources/doc_a.yaml',
                    sourceBaseName: 'doc_a',
                    template: { UniqueA: {} }
                },
                {
                    sourcePath: 'sources/doc_b.yaml',
                    sourceBaseName: 'doc_b',
                    template: { ConflictKey: {} }
                },
                {
                    sourcePath: 'sources/doc_c.yaml',
                    sourceBaseName: 'doc_c',
                    template: { ConflictKey: {} }
                }
            ]
        };

        // 複数ドキュメント間での重複キー競合を含む生成処理の実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        const docA = data.processedDocuments[0];

        // 競合キーに対する先頭マッチ解決の検証
        const resolved = docA.linkResolver('ConflictKey');
        expect(resolved).toBe('doc_1');
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ConflictKey'));

        warnSpy.mockRestore();
    });

    it('should resolve to explicit document when scope prefix is specified', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const doc = {
            template: {},
            mode: 'generic' as const,
            documents: [
                {
                    sourcePath: 'sources/doc_a.yaml',
                    sourceBaseName: 'doc_a',
                    template: { UniqueA: {} }
                },
                {
                    sourcePath: 'sources/doc_b.yaml',
                    sourceBaseName: 'doc_b',
                    template: { ConflictKey: {} }
                },
                {
                    sourcePath: 'sources/doc_c.yaml',
                    sourceBaseName: 'doc_c',
                    template: { ConflictKey: {} }
                }
            ]
        };

        // 明示的スコープ指定を伴う生成処理の実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        const docA = data.processedDocuments[0];

        // 明示指定によるスコープ接頭辞解決の検証
        expect(docA.linkResolver('ConflictKey', 'doc_c')).toBe('doc_2');
        expect(docA.linkResolver('ConflictKey', 'doc_b.yaml')).toBe('doc_1');
        expect(docA.linkResolver('ConflictKey', 'doc_2')).toBe('doc_2');
    });

    it('should resolve cross document link based on second level key when top level keys are identical', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const doc = {
            template: {},
            mode: 'generic' as const,
            documents: [
                {
                    sourcePath: 'sources/ecs_a.yaml',
                    sourceBaseName: 'ecs_a',
                    template: { Tasks: { WorkerA: { cpu: 256 } } }
                },
                {
                    sourcePath: 'sources/ecs_b.yaml',
                    sourceBaseName: 'ecs_b',
                    template: { Tasks: { WorkerB: { cpu: 512 } } }
                }
            ]
        };

        // 同一トップレベルキーを持つ複数ドキュメントの生成処理実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        const docA = data.processedDocuments[0];

        // 自ドキュメント内子キーの解決検証
        expect(docA.linkResolver(['Tasks', 'WorkerA'])).toBe('doc_0');
        // 他ドキュメント内子キーの解決検証
        expect(docA.linkResolver(['Tasks', 'WorkerB'])).toBe('doc_1');
    });

    it('should suppress duplicate warning logs for the same conflicting key in a single build', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const warnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => {});

        const doc = {
            template: {},
            mode: 'generic' as const,
            documents: [
                {
                    sourcePath: 'sources/a.yaml',
                    sourceBaseName: 'a',
                    template: { Unique: {} }
                },
                {
                    sourcePath: 'sources/b.yaml',
                    sourceBaseName: 'b',
                    template: { DupKey: {} }
                },
                {
                    sourcePath: 'sources/c.yaml',
                    sourceBaseName: 'c',
                    template: { DupKey: {} }
                }
            ]
        };

        // 重複キーを含むドキュメントの生成処理実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        const docA = data.processedDocuments[0];

        // 同一重複キーに対する大文字小文字の差異を含む複数回解決の実行
        docA.linkResolver('DupKey');
        docA.linkResolver('dupkey');
        docA.linkResolver(['DupKey']);

        // 警告ログの呼び出しが初回1回のみであることの検証
        expect(warnSpy).toHaveBeenCalledTimes(1);
        warnSpy.mockRestore();
    });

    it('should match nested directory scope prefix and warn on invalid scope', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const warnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => {});

        const doc = {
            template: {},
            mode: 'generic' as const,
            documents: [
                {
                    sourcePath: 'sources/main.yaml',
                    sourceBaseName: 'main',
                    template: { Root: {} }
                },
                {
                    sourcePath: 'sources/sub/service.yaml',
                    sourceBaseName: 'service',
                    template: { ServiceKey: {} }
                }
            ]
        };

        // 階層パスを持つドキュメントの生成処理実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        const mainDoc = data.processedDocuments[0];

        // サブディレクトリ付きスコープ指定の解決検証
        expect(mainDoc.linkResolver('ServiceKey', 'sub/service')).toBe('doc_1');
        expect(mainDoc.linkResolver('ServiceKey', 'sub/service.yaml')).toBe('doc_1');

        // 無効なスコープ指定時の警告出力およびフォールバック検証
        const fallback = mainDoc.linkResolver('ServiceKey', 'invalid_scope');
        expect(fallback).toBe('doc_0');
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('invalid_scope'));

        warnSpy.mockRestore();
    });

    it('should resolve single key link to child key in other document when section is omitted', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const doc = {
            template: {},
            mode: 'generic' as const,
            documents: [
                {
                    sourcePath: 'sources/doc_a.yaml',
                    sourceBaseName: 'doc_a',
                    template: { Resources: { ResourceA: { Type: 'TypeA' } } }
                },
                {
                    sourcePath: 'sources/doc_b.yaml',
                    sourceBaseName: 'doc_b',
                    template: { Resources: { ResourceB: { Type: 'TypeB' } } }
                }
            ]
        };

        // 複数ドキュメントの生成処理実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        const docA = data.processedDocuments[0];

        // 自ドキュメント内子キーの単一指定解決検証
        expect(docA.linkResolver('ResourceA')).toBe('doc_0');
        // 他ドキュメント内子キーの単一指定解決検証
        expect(docA.linkResolver('ResourceB')).toBe('doc_1');
    });

    it('should not misidentify empty section or scalar section as matching non-existent child key', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const doc = {
            template: {},
            mode: 'generic' as const,
            documents: [
                {
                    sourcePath: 'sources/doc_a.yaml',
                    sourceBaseName: 'doc_a',
                    template: { Description: 'ScalarText', EmptySection: {} }
                },
                {
                    sourcePath: 'sources/doc_b.yaml',
                    sourceBaseName: 'doc_b',
                    template: { EmptySection: { TargetChild: { Val: 1 } } }
                }
            ]
        };

        // 複数ドキュメントの生成処理実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        const docA = data.processedDocuments[0];

        // 子要素を持たないセクションに対して他ドキュメントの正規子キーへ正しく解決されることの検証
        expect(docA.linkResolver(['EmptySection', 'TargetChild'])).toBe('doc_1');
    });

    it('should resolve to self document with duplicate warning when key exists in both self and other document', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const warnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => {});

        const doc = {
            template: {},
            mode: 'generic' as const,
            documents: [
                {
                    sourcePath: 'sources/doc_a.yaml',
                    sourceBaseName: 'doc_a',
                    template: { SharedKey: { val: 'a' } }
                },
                {
                    sourcePath: 'sources/doc_b.yaml',
                    sourceBaseName: 'doc_b',
                    template: { SharedKey: { val: 'b' } }
                }
            ]
        };

        // 複数ドキュメントの生成処理実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        const docA = data.processedDocuments[0];

        // 自ドキュメント優先解決と重複警告出力を同時に検証
        const resolved = docA.linkResolver('SharedKey');
        expect(resolved).toBe('doc_0');
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SharedKey'));

        warnSpy.mockRestore();
    });

    it('should prioritize top-level key match over child key match on single key lookup', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const warnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => {});

        const doc = {
            template: {},
            mode: 'generic' as const,
            documents: [
                {
                    sourcePath: 'sources/doc_a.yaml',
                    sourceBaseName: 'doc_a',
                    template: { ConfigSection: { item: 'val' } }
                },
                {
                    sourcePath: 'sources/doc_b.yaml',
                    sourceBaseName: 'doc_b',
                    template: { OtherSection: { ConfigSection: { sub: 'val' } } }
                }
            ]
        };

        // 複数ドキュメントの生成処理実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        const docB = data.processedDocuments[1];

        // トップレベルキーへの優先解決検証
        expect(docB.linkResolver('ConfigSection')).toBe('doc_0');
        // 子キーとの誤競合による警告が発生しないことの検証
        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    it('should report accurate resolved document name in duplicate warning when self document is secondary match', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const warnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => {});

        const doc = {
            template: {},
            mode: 'generic' as const,
            documents: [
                {
                    sourcePath: 'sources/doc_a.yaml',
                    sourceBaseName: 'doc_a',
                    template: { DupKey: { val: 'a' } }
                },
                {
                    sourcePath: 'sources/doc_b.yaml',
                    sourceBaseName: 'doc_b',
                    template: { DupKey: { val: 'b' } }
                }
            ]
        };

        // 複数ドキュメントの生成処理実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        const docB = data.processedDocuments[1];

        // 2番目ドキュメントからの解決時に自ドキュメント名が警告メッセージに含まれることの検証
        const resolved = docB.linkResolver('DupKey');
        expect(resolved).toBe('doc_1');
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Resolved to 'doc_b'"));

        warnSpy.mockRestore();
    });

    it('should resolve multi-segment link to child property across documents when section name is omitted', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const doc = {
            template: {},
            mode: 'generic' as const,
            documents: [
                {
                    sourcePath: 'sources/doc_a.yaml',
                    sourceBaseName: 'doc_a',
                    template: {
                        Resources: {
                            MyServer: {
                                Type: 'AWS::EC2::Instance',
                                Properties: {
                                    ImageId: 'ami-123456'
                                }
                            }
                        }
                    }
                },
                {
                    sourcePath: 'sources/doc_b.yaml',
                    sourceBaseName: 'doc_b',
                    template: {
                        Resources: {
                            OtherServer: {
                                Type: 'AWS::EC2::Instance'
                            }
                        }
                    }
                }
            ]
        };

        // 複数ドキュメントの生成処理実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        const docB = data.processedDocuments[1];

        // セクション名省略での直下属性解決検証
        expect(docB.linkResolver(['MyServer', 'Type'])).toBe('doc_0');
        // セクション名省略でのProperties配下プロパティ解決検証
        expect(docB.linkResolver(['MyServer', 'ImageId'])).toBe('doc_0');
    });

    it('should suppress duplicate warning logs for the same invalid scope across multiple calls', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const warnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => {});

        const doc = {
            template: {},
            mode: 'generic' as const,
            documents: [
                {
                    sourcePath: 'sources/doc_a.yaml',
                    sourceBaseName: 'doc_a',
                    template: { Resources: { SrvA: {} } }
                },
                {
                    sourcePath: 'sources/doc_b.yaml',
                    sourceBaseName: 'doc_b',
                    template: { Resources: { SrvB: {} } }
                }
            ]
        };

        // 複数ドキュメントの生成処理実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        const docA = data.processedDocuments[0];

        // 同一の無効スコープに対する連続解決の実行
        docA.linkResolver('SrvA', 'nonexistent_scope');
        docA.linkResolver('SrvB', 'nonexistent_scope');

        // 無効スコープ警告が1回のみ出力されることの検証
        const invalidScopeCalls = warnSpy.mock.calls.filter(
            (call) => call[0] && String(call[0]).includes('nonexistent_scope')
        );
        expect(invalidScopeCalls).toHaveLength(1);

        warnSpy.mockRestore();
    });

    it('should complete omitted section name and generate exact anchor id matching DOM element', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const doc = {
            template: {},
            mode: 'generic' as const,
            documents: [
                {
                    sourcePath: 'sources/doc_a.yaml',
                    sourceBaseName: 'doc_a',
                    template: {
                        Resources: {
                            MyServer: {
                                Type: 'AWS::EC2::Instance',
                                Properties: {
                                    ImageId: 'ami-123456'
                                }
                            }
                        }
                    }
                },
                {
                    sourcePath: 'sources/doc_b.yaml',
                    sourceBaseName: 'doc_b',
                    template: {
                        Resources: {
                            OtherServer: {
                                Type: 'AWS::EC2::Instance'
                            }
                        }
                    }
                }
            ]
        };

        // 複数ドキュメントの生成処理実行
        Generator.generate(doc, 't.ejs', mockStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        const docB = data.processedDocuments[1];

        // セクション名省略リンクに対する詳細解決情報の検証
        const detailSingle = docB.linkResolver.resolve('MyServer');
        expect(detailSingle).toEqual({
            prefix: 'doc_0',
            segments: ['Resources', 'MyServer'],
            isPropertiesBlock: undefined
        });

        const detailProp = docB.linkResolver.resolve(['MyServer', 'ImageId']);
        expect(detailProp).toEqual({
            prefix: 'doc_0',
            segments: ['Resources', 'MyServer', 'Properties', 'ImageId'],
            isPropertiesBlock: true
        });

        // マークダウン描画時の完全修飾アンカー生成の検証
        const renderedSingle = MarkdownProcessor.render('[Server](MyServer)', docB.linkResolver);
        expect(renderedSingle).toContain('href="#doc_0.Resources.MyServer"');

        const renderedProp = MarkdownProcessor.render('[Image](MyServer.ImageId)', docB.linkResolver);
        expect(renderedProp).toContain('href="#doc_0.Resources.MyServer.Properties.ImageId"');
    });
});
