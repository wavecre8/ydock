import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocDockBuilder } from './builder';
import { Loader } from './loader';
import { PageBuilder } from './page-builder';
import { DocDockConstants } from './constants';

describe('DocDockBuilder', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should merge global directory settings into page config when page settings are omitted', async () => {
        const mockConfig = {
            guideDir: 'global_guides',
            aliasDir: 'global_aliases',
            excludeDir: 'global_excludes',
            pages: [
                {
                    title: 'Test Page',
                    sources: ['test.yml'],
                    output: 'output/test.html'
                }
            ]
        };

        // 設定読み込みのモック
        vi.spyOn(Loader, 'loadConfig').mockReturnValue(mockConfig as any);
        // ページビルドのモック
        const pageBuildSpy = vi.spyOn(PageBuilder, 'build').mockResolvedValue(undefined);

        // ビルド処理の実行
        await DocDockBuilder.build({ configPath: 'setting.config.yml', silent: true });

        // グローバルディレクトリ設定のマージ検証
        expect(pageBuildSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Test Page',
                guideDir: 'global_guides',
                aliasDir: 'global_aliases',
                excludeDir: 'global_excludes'
            }),
            'generic',
            'ja',
            expect.any(String),
            expect.any(String),
            true
        );
    });

    it('should prioritize page-specific directory settings over global settings', async () => {
        const mockConfig = {
            guideDir: 'global_guides',
            aliasDir: 'global_aliases',
            excludeDir: 'global_excludes',
            pages: [
                {
                    title: 'Test Page',
                    sources: ['test.yml'],
                    output: 'output/test.html',
                    guideDir: 'page_guides',
                    aliasDir: 'page_aliases',
                    excludeDir: 'page_excludes'
                }
            ]
        };

        // 設定読み込みのモック
        vi.spyOn(Loader, 'loadConfig').mockReturnValue(mockConfig as any);
        // ページビルドのモック
        const pageBuildSpy = vi.spyOn(PageBuilder, 'build').mockResolvedValue(undefined);

        // ビルド処理の実行
        await DocDockBuilder.build({ configPath: 'setting.config.yml', silent: true });

        // ページ固有設定の優先検証
        expect(pageBuildSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Test Page',
                guideDir: 'page_guides',
                aliasDir: 'page_aliases',
                excludeDir: 'page_excludes'
            }),
            'generic',
            'ja',
            expect.any(String),
            expect.any(String),
            true
        );
    });

    it('should fallback to default constants when neither page nor global settings are provided', async () => {
        const mockConfig = {
            pages: [
                {
                    title: 'Test Page',
                    sources: ['test.yml'],
                    output: 'output/test.html'
                }
            ]
        };

        // 設定読み込みのモック
        vi.spyOn(Loader, 'loadConfig').mockReturnValue(mockConfig as any);
        // ページビルドのモック
        const pageBuildSpy = vi.spyOn(PageBuilder, 'build').mockResolvedValue(undefined);

        // ビルド処理の実行
        await DocDockBuilder.build({ configPath: 'setting.config.yml', silent: true });

        // 定数デフォルト値のフォールバック検証
        expect(pageBuildSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Test Page',
                guideDir: DocDockConstants.Defaults.GuideDir,
                aliasDir: DocDockConstants.Defaults.AliasDir,
                excludeDir: DocDockConstants.Defaults.ExcludeDir
            }),
            'generic',
            'ja',
            expect.any(String),
            expect.any(String),
            true
        );
    });
});
