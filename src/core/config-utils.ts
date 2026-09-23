import * as path from 'path';
import { DocDockConstants } from './constants';
import { DocDockConfig, PageConfig } from '../types';

export class ConfigUtils {
    /**
     * ページ設定に対するグローバルおよびデフォルトディレクトリの補完
     */
    static getEffectivePage(page: PageConfig, config?: Partial<DocDockConfig>): PageConfig {
        const defaultGuideDir = config?.guideDir || DocDockConstants.Defaults.GuideDir;
        const defaultAliasDir = config?.aliasDir || DocDockConstants.Defaults.AliasDir;
        const defaultExcludeDir = config?.excludeDir || DocDockConstants.Defaults.ExcludeDir;

        return {
            ...page,
            guideDir: page.guideDir || defaultGuideDir,
            aliasDir: page.aliasDir || defaultAliasDir,
            excludeDir: page.excludeDir || defaultExcludeDir
        };
    }

    /**
     * 全ページ設定に対する一括ディレクトリ補完
     */
    static getEffectivePages(config: DocDockConfig): PageConfig[] {
        if (!config || !Array.isArray(config.pages)) {
            return [];
        }
        return config.pages.map((page) => this.getEffectivePage(page, config));
    }

    /**
     * カレントページから見た全ドキュメントおよびページの相対リンク解決マップの生成
     */
    static createPageRouteMap(currentPage: PageConfig, allPages: PageConfig[]): Map<string, string> {
        const routeMap = new Map<string, string>();
        const currentDir = path.dirname(currentPage.output);

        for (const targetPage of allPages) {
            // カレントページの出力ディレクトリを基準とする相対パスの算出
            const relativePath = path.relative(currentDir, targetPage.output).replace(/\\/g, '/');

            // 出力ファイル名自体の登録
            const outputBaseName = path.basename(targetPage.output, path.extname(targetPage.output)).toLowerCase();
            const outputFileName = path.basename(targetPage.output).toLowerCase();
            routeMap.set(outputBaseName, relativePath);
            routeMap.set(outputFileName, relativePath);

            // ページタイトルの登録
            if (targetPage.title) {
                routeMap.set(targetPage.title.trim().toLowerCase(), relativePath);
            }

            // 各ソースファイル識別子の登録
            const sources = targetPage.sources || targetPage.templates || [];
            for (const src of sources) {
                const normalizedSrc = src.replace(/\\/g, '/').toLowerCase();
                const ext = path.extname(normalizedSrc);
                const srcBaseName = path.basename(normalizedSrc, ext);
                const srcFileName = path.basename(normalizedSrc);
                const srcWithoutExt = ext ? normalizedSrc.slice(0, -ext.length) : normalizedSrc;

                routeMap.set(srcBaseName, relativePath);
                routeMap.set(srcFileName, relativePath);
                routeMap.set(normalizedSrc, relativePath);
                routeMap.set(srcWithoutExt, relativePath);
            }
        }

        return routeMap;
    }
}
