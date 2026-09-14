import * as path from 'path';
import { Loader } from './loader';
import { DocDockConfig, PageConfig } from '../types';
import { DocDockConstants } from './constants';
import { Logger } from './logger';
import { PageBuilder } from './page-builder';
import { IndexBuilder } from './index-builder';
import { ConfigValidator } from './config-validator';

export interface BuildOptions {
    configPath: string;
    silent?: boolean;
}

export class DocDockBuilder {
    static async build(options: BuildOptions): Promise<void> {
        const resolvedConfigPath = path.resolve(options.configPath);
        if (options.silent) Logger.setSilent(true);
        Logger.info(`Loading config from ${resolvedConfigPath}...`);

        const rawConfig = Loader.loadConfig(resolvedConfigPath);
        // 設定スキーマおよび出力パス整合性の検証
        const config: DocDockConfig = ConfigValidator.validate(rawConfig, resolvedConfigPath);

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
