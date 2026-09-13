import * as path from 'path';
import { Loader } from './loader';
import { DocDockConfig, PageConfig } from '../types';
import { DocDockConstants } from './constants';
import { Logger } from './logger';
import { PageBuilder } from './page-builder';
import { IndexBuilder } from './index-builder';

export interface BuildOptions {
    configPath: string;
    silent?: boolean;
}

export class DocDockBuilder {
    static async build(options: BuildOptions): Promise<void> {
        const resolvedConfigPath = path.resolve(options.configPath);
        if (options.silent) Logger.setSilent(true);
        Logger.info(`Loading config from ${resolvedConfigPath}...`);

        const config = Loader.loadConfig(resolvedConfigPath) as DocDockConfig;
        // ページ設定の存在および配列判定
        if (!config || !Array.isArray(config.pages) || config.pages.length === 0) {
            Logger.warn('No pages defined in configuration.');
            return;
        }

        const globalMode = config.mode || DocDockConstants.Defaults.Mode;
        const language = config.lang || DocDockConstants.Defaults.Language;
        const layoutPath = path.join(__dirname, DocDockConstants.Defaults.TemplateLayout);

        const defaultGuideDir = config.guideDir || DocDockConstants.Defaults.GuideDir;
        const defaultAliasDir = config.aliasDir || DocDockConstants.Defaults.AliasDir;
        const defaultExcludeDir = config.excludeDir || DocDockConstants.Defaults.ExcludeDir;

        for (const page of config.pages) {
            // ページ設定に対するグローバルおよびデフォルトディレクトリの補完
            const effectivePage: PageConfig = {
                ...page,
                guideDir: page.guideDir || defaultGuideDir,
                aliasDir: page.aliasDir || defaultAliasDir,
                excludeDir: page.excludeDir || defaultExcludeDir
            };
            await PageBuilder.build(effectivePage, globalMode as 'cfn' | 'generic', language, resolvedConfigPath, layoutPath, options.silent);
        }

        if (config.index) {
            await IndexBuilder.build(config, resolvedConfigPath, globalMode, language, options.silent);
        }

        Logger.info('Build complete.');
    }
}
