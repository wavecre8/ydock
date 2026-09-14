import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { IndexBuilder } from './index-builder';
import { IndexPageItem, IndexGroupConfig } from '../types';

describe('IndexBuilder', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('buildGroups', () => {
        it('グループ指定が一切存在しない場合はhasGroupsをfalseとし単一グループを返却する', () => {
            const pages: IndexPageItem[] = [
                { title: 'Page A', filename: 'page-a.html', link: 'page-a.html', mode: 'generic' },
                { title: 'Page B', filename: 'page-b.html', link: 'page-b.html', mode: 'cfn' }
            ];

            // グループ分類処理の実行
            const result = IndexBuilder.buildGroups(pages, undefined, 'その他');

            expect(result.hasGroups).toBe(false);
            expect(result.groups).toHaveLength(1);
            expect(result.groups[0].name).toBe('その他');
            expect(result.groups[0].pages).toHaveLength(2);
        });

        it('ページ側にgroup指定が存在する場合は出現順にグループ化し未分類ページを末尾に追加する', () => {
            const pages: IndexPageItem[] = [
                { title: 'VPC', filename: 'vpc.html', link: 'vpc.html', mode: 'cfn', group: 'ネットワーク' },
                { title: 'ECS', filename: 'ecs.html', link: 'ecs.html', mode: 'cfn', group: 'コンピュート' },
                { title: 'Subnet', filename: 'subnet.html', link: 'subnet.html', mode: 'cfn', group: 'ネットワーク' },
                { title: 'Misc', filename: 'misc.html', link: 'misc.html', mode: 'generic' }
            ];

            // グループ分類処理の実行
            const result = IndexBuilder.buildGroups(pages, undefined, 'その他');

            expect(result.hasGroups).toBe(true);
            expect(result.groups).toHaveLength(3);
            expect(result.groups[0].name).toBe('ネットワーク');
            expect(result.groups[0].pages).toHaveLength(2);
            expect(result.groups[0].pages[0].title).toBe('VPC');
            expect(result.groups[0].pages[1].title).toBe('Subnet');

            expect(result.groups[1].name).toBe('コンピュート');
            expect(result.groups[1].pages).toHaveLength(1);
            expect(result.groups[1].pages[0].title).toBe('ECS');

            expect(result.groups[2].name).toBe('その他');
            expect(result.groups[2].pages).toHaveLength(1);
            expect(result.groups[2].pages[0].title).toBe('Misc');
        });

        it('明示的なグループ設定が存在する場合は指定順序に従って集計し空グループは除外する', () => {
            const configuredGroups: IndexGroupConfig[] = [
                { id: 'compute', name: 'コンピュート基盤' },
                { id: 'network', name: 'ネットワーク基盤' },
                { id: 'storage', name: 'ストレージ基盤' }
            ];

            const pages: IndexPageItem[] = [
                { title: 'Subnet', filename: 'subnet.html', link: 'subnet.html', mode: 'cfn', group: 'network' },
                { title: 'ECS', filename: 'ecs.html', link: 'ecs.html', mode: 'cfn', group: 'compute' },
                { title: 'VPC', filename: 'vpc.html', link: 'vpc.html', mode: 'cfn', group: 'network' },
                { title: 'Extra', filename: 'extra.html', link: 'extra.html', mode: 'generic' }
            ];

            // グループ分類処理の実行
            const result = IndexBuilder.buildGroups(pages, configuredGroups, 'その他');

            expect(result.hasGroups).toBe(true);
            // ストレージ基盤はページが存在しないため除外され合計3グループ
            expect(result.groups).toHaveLength(3);

            // コンピュート基盤の検証
            expect(result.groups[0].name).toBe('コンピュート基盤');
            expect(result.groups[0].pages).toHaveLength(1);
            expect(result.groups[0].pages[0].title).toBe('ECS');

            // ネットワーク基盤の検証
            expect(result.groups[1].name).toBe('ネットワーク基盤');
            expect(result.groups[1].pages).toHaveLength(2);

            // 未分類グループの検証
            expect(result.groups[2].name).toBe('その他');
            expect(result.groups[2].pages).toHaveLength(1);
            expect(result.groups[2].pages[0].title).toBe('Extra');
        });

        it('グループ設定のidまたはnameのいずれを指定しても同一グループへ分類される', () => {
            const configuredGroups: IndexGroupConfig[] = [
                { id: 'network-id', name: 'Network Section' }
            ];

            const pages: IndexPageItem[] = [
                { title: 'Page By ID', filename: 'p1.html', link: 'p1.html', mode: 'cfn', group: 'network-id' },
                { title: 'Page By Name', filename: 'p2.html', link: 'p2.html', mode: 'cfn', group: 'Network Section' },
                { title: 'Page With Space', filename: 'p3.html', link: 'p3.html', mode: 'cfn', group: '  network-id  ' }
            ];

            // グループ分類処理の実行
            const result = IndexBuilder.buildGroups(pages, configuredGroups, 'その他');

            expect(result.hasGroups).toBe(true);
            expect(result.groups).toHaveLength(1);
            expect(result.groups[0].name).toBe('Network Section');
            expect(result.groups[0].pages).toHaveLength(3);
        });

        it('設定に未分類グループ名と同名のグループが存在する場合は未分類ページが合流する', () => {
            const configuredGroups: IndexGroupConfig[] = [
                { id: 'network', name: 'Network' },
                { id: 'other', name: 'Other' }
            ];

            const pages: IndexPageItem[] = [
                { title: 'Page Net', filename: 'net.html', link: 'net.html', mode: 'cfn', group: 'network' },
                { title: 'Page Explicit Other', filename: 'o1.html', link: 'o1.html', mode: 'generic', group: 'Other' },
                { title: 'Page Uncategorized', filename: 'o2.html', link: 'o2.html', mode: 'generic' }
            ];

            // グループ分類処理の実行
            const result = IndexBuilder.buildGroups(pages, configuredGroups, 'Other');

            expect(result.hasGroups).toBe(true);
            expect(result.groups).toHaveLength(2);
            expect(result.groups[0].name).toBe('Network');
            expect(result.groups[0].pages).toHaveLength(1);

            // Otherグループに明示指定ページと未分類ページが集約されることの検証
            expect(result.groups[1].name).toBe('Other');
            expect(result.groups[1].pages).toHaveLength(2);
            expect(result.groups[1].pages[0].title).toBe('Page Explicit Other');
            expect(result.groups[1].pages[1].title).toBe('Page Uncategorized');
        });

        it('ページ定義のみで未分類グループ名と同名が指定された場合も未分類ページが合流する', () => {
            const pages: IndexPageItem[] = [
                { title: 'Page Explicit Other', filename: 'o1.html', link: 'o1.html', mode: 'generic', group: 'Other' },
                { title: 'Page Uncategorized', filename: 'o2.html', link: 'o2.html', mode: 'generic' }
            ];

            // グループ分類処理の実行
            const result = IndexBuilder.buildGroups(pages, undefined, 'Other');

            expect(result.hasGroups).toBe(true);
            expect(result.groups).toHaveLength(1);
            expect(result.groups[0].name).toBe('Other');
            expect(result.groups[0].pages).toHaveLength(2);
        });
    });

    describe('build', () => {
        it('設定ファイルのindex指定に基づいてグループ化されたHTMLを生成する', async () => {
            const tempDir = path.join(__dirname, '../../test_temp_index');
            const outputPath = path.join(tempDir, 'output/index.html');
            const configPath = path.join(tempDir, 'setting.config.yml');

            const mockConfig = {
                index: {
                    output: 'output/index.html',
                    title: 'インデックス検証'
                },
                pages: [
                    {
                        title: 'VPC設定',
                        sources: ['sources/vpc.yml'],
                        output: 'output/vpc.html',
                        group: 'ネットワーク'
                    },
                    {
                        title: 'ECS設定',
                        sources: ['sources/ecs.yml'],
                        output: 'output/ecs.html',
                        group: 'コンピュート'
                    }
                ]
            };

            // インデックスビルド処理の実行
            await IndexBuilder.build(mockConfig as any, configPath, 'generic', 'ja', true);

            // 生成ファイルの存在検証
            expect(fs.existsSync(outputPath)).toBe(true);
            const content = fs.readFileSync(outputPath, 'utf8');

            // タイトルおよびグループ名の描画検証
            expect(content).toContain('インデックス検証');
            expect(content).toContain('ネットワーク');
            expect(content).toContain('コンピュート');
            expect(content).toContain('VPC設定');
            expect(content).toContain('ECS設定');
            expect(content).toContain('search-input');

            // クリーンアップ
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
            const outputDir = path.dirname(outputPath);
            if (fs.existsSync(outputDir)) {
                fs.rmdirSync(outputDir);
            }
            if (fs.existsSync(tempDir)) {
                fs.rmdirSync(tempDir);
            }
        });

        it('空白のみのタイトルが指定された場合はファイル名からタイトルを導出する', async () => {
            const tempDir = path.join(__dirname, '../../test_temp_fallback');
            const outputPath = path.join(tempDir, 'output/index.html');
            const configPath = path.join(tempDir, 'setting.config.yml');

            const mockConfig = {
                index: {
                    output: 'output/index.html'
                },
                pages: [
                    {
                        title: '   ',
                        output: 'output/fallback-name.html'
                    }
                ]
            };

            // インデックスビルド処理の実行
            await IndexBuilder.build(mockConfig as any, configPath, 'generic', 'ja', true);

            // 生成ファイルの検証
            expect(fs.existsSync(outputPath)).toBe(true);
            const content = fs.readFileSync(outputPath, 'utf8');
            expect(content).toContain('fallback-name');

            // クリーンアップ
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
            const outputDir = path.dirname(outputPath);
            if (fs.existsSync(outputDir)) {
                fs.rmdirSync(outputDir);
            }
            if (fs.existsSync(tempDir)) {
                fs.rmdirSync(tempDir);
            }
        });
    });
});
