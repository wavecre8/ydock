import { describe, it, expect } from 'vitest';
import { ConfigValidator } from './config-validator';
import { ConfigValidationError } from './errors';

describe('ConfigValidator', () => {
    const configPath = 'd:/projects/ydock/setting.config.yml';

    describe('validate', () => {
        it('正常な設定オブジェクトをそのまま返却する', () => {
            const validConfig = {
                pages: [
                    {
                        title: 'Page 1',
                        output: 'output/page1.html',
                        sources: ['sources/page1.yml']
                    }
                ],
                index: {
                    output: 'output/index.html',
                    title: 'Portal Index',
                    groups: [
                        { id: 'grp1', name: 'Group 1' }
                    ]
                }
            };

            // 設定バリデーションの実行
            const result = ConfigValidator.validate(validConfig, configPath);
            expect(result).toBeDefined();
            expect(result.pages).toHaveLength(1);
        });

        it('pagesが未定義または空配列の場合は検証エラーを送出する', () => {
            const emptyConfig = {
                pages: []
            };

            // 例外送出の検証
            expect(() => {
                ConfigValidator.validate(emptyConfig, configPath);
            }).toThrow(ConfigValidationError);
        });

        it('ページのoutputプロパティが空文字列の場合は検証エラーを送出する', () => {
            const invalidConfig = {
                pages: [
                    {
                        title: 'Invalid Page',
                        output: ''
                    }
                ]
            };

            // 例外送出の検証
            expect(() => {
                ConfigValidator.validate(invalidConfig, configPath);
            }).toThrow(ConfigValidationError);
        });

        it('重複する出力パスが指定された場合は重複検出エラーを送出する', () => {
            const duplicateConfig = {
                pages: [
                    {
                        title: 'Page A',
                        output: 'output/duplicate.html'
                    },
                    {
                        title: 'Page B',
                        output: 'output/duplicate.html'
                    }
                ]
            };

            // 重複パス検出例外の検証
            expect(() => {
                ConfigValidator.validate(duplicateConfig, configPath);
            }).toThrow(ConfigValidationError);
        });

        it('相対パスの正規化後に重複する出力パスも検出してエラーを送出する', () => {
            const duplicateNormalizedConfig = {
                pages: [
                    {
                        title: 'Page A',
                        output: 'output/sub/../page.html'
                    },
                    {
                        title: 'Page B',
                        output: 'output/page.html'
                    }
                ]
            };

            // 正規化後重複パス検出例外の検証
            expect(() => {
                ConfigValidator.validate(duplicateNormalizedConfig, configPath);
            }).toThrow(ConfigValidationError);
        });

        it('ポータル出力パスと個別ページの出力パスが重複する場合はエラーを送出する', () => {
            const conflictConfig = {
                index: {
                    output: 'output/portal.html'
                },
                pages: [
                    {
                        title: 'Page A',
                        output: 'output/portal.html'
                    }
                ]
            };

            // ポータル重複パス検出例外の検証
            expect(() => {
                ConfigValidator.validate(conflictConfig, configPath);
            }).toThrow(ConfigValidationError);
        });

        it('グループ設定内で同一のidが重複定義された場合はエラーを送出する', () => {
            const duplicateGroupIdConfig = {
                index: {
                    output: 'output/index.html',
                    groups: [
                        { id: 'network', name: 'Network 1' },
                        { id: 'network', name: 'Network 2' }
                    ]
                },
                pages: [
                    {
                        title: 'Page A',
                        output: 'output/page.html'
                    }
                ]
            };

            // グループ識別子重複検出例外の検証
            expect(() => {
                ConfigValidator.validate(duplicateGroupIdConfig, configPath);
            }).toThrow(ConfigValidationError);
        });

        it('グループ設定内で同一のnameが重複定義された場合はエラーを送出する', () => {
            const duplicateGroupNameConfig = {
                index: {
                    output: 'output/index.html',
                    groups: [
                        { id: 'net1', name: 'Network' },
                        { id: 'net2', name: 'Network' }
                    ]
                },
                pages: [
                    {
                        title: 'Page A',
                        output: 'output/page.html'
                    }
                ]
            };

            // グループ名称重複検出例外の検証
            expect(() => {
                ConfigValidator.validate(duplicateGroupNameConfig, configPath);
            }).toThrow(ConfigValidationError);
        });

        it('異なるグループ間でidとnameが重複定義された場合はエラーを送出する', () => {
            const crossConflictConfig = {
                index: {
                    output: 'output/index.html',
                    groups: [
                        { id: 'network', name: 'Network Section' },
                        { id: 'compute', name: 'network' }
                    ]
                },
                pages: [
                    {
                        title: 'Page A',
                        output: 'output/page.html'
                    }
                ]
            };

            // グループ識別子と名称の衝突検出例外の検証
            expect(() => {
                ConfigValidator.validate(crossConflictConfig, configPath);
            }).toThrow(ConfigValidationError);
        });

        it('出力パスに空白文字のみが指定された場合はスキーマ検証エラーを送出する', () => {
            const whitespaceOutputConfig = {
                pages: [
                    {
                        title: 'Page A',
                        output: '   '
                    }
                ]
            };

            // 空白出力パス拒否例外の検証
            expect(() => {
                ConfigValidator.validate(whitespaceOutputConfig, configPath);
            }).toThrow(ConfigValidationError);
        });

        it('グループ名に空白文字のみが指定された場合はスキーマ検証エラーを送出する', () => {
            const whitespaceGroupNameConfig = {
                index: {
                    output: 'output/index.html',
                    groups: [
                        { name: '   ' }
                    ]
                },
                pages: [
                    {
                        title: 'Page A',
                        output: 'output/page.html'
                    }
                ]
            };

            // 空白グループ名拒否例外の検証
            expect(() => {
                ConfigValidator.validate(whitespaceGroupNameConfig, configPath);
            }).toThrow(ConfigValidationError);
        });

        it('グループ識別子に空白文字のみが指定された場合はスキーマ検証エラーを送出する', () => {
            const whitespaceGroupIdConfig = {
                index: {
                    output: 'output/index.html',
                    groups: [
                        { id: '   ', name: 'Valid Group' }
                    ]
                },
                pages: [
                    {
                        title: 'Page A',
                        output: 'output/page.html'
                    }
                ]
            };

            // 空白グループ識別子拒否例外の検証
            expect(() => {
                ConfigValidator.validate(whitespaceGroupIdConfig, configPath);
            }).toThrow(ConfigValidationError);
        });

        it('ディレクトリ設定に空白文字のみが指定された場合はスキーマ検証エラーを送出する', () => {
            const whitespaceDirConfig = {
                guideDir: '   ',
                pages: [
                    {
                        title: 'Page A',
                        output: 'output/page.html',
                        aliasDir: '   '
                    }
                ]
            };

            // 空白ディレクトリ設定拒否例外の検証
            expect(() => {
                ConfigValidator.validate(whitespaceDirConfig, configPath);
            }).toThrow(ConfigValidationError);
        });
    });
});
