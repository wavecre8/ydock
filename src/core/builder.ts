import * as path from 'path';
import { Loader } from './loader';
import { DocDockConfig } from '../types';
import { DocDockConstants } from './constants';
import { Logger } from './logger';
import { PageBuilder } from './page-builder';
import { IndexBuilder } from './index-builder';
import { ConfigValidator } from './config-validator';
import { ConfigUtils } from './config-utils';

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

        // 補完済みページ設定一覧の取得
        const effectivePages = ConfigUtils.getEffectivePages(config);
        for (const effectivePage of effectivePages) {
            // カレントページ視点での相対ルーティングマップの導出
            const pageRouteMap = ConfigUtils.createPageRouteMap(effectivePage, effectivePages);
            await PageBuilder.build(
                effectivePage,
                globalMode,
                language,
                resolvedConfigPath,
                layoutPath,
                options.silent,
                pageRouteMap
            );
        }

        if (config.index) {
            await IndexBuilder.build(config, resolvedConfigPath, globalMode, language, options.silent);
        }

        Logger.info('Build complete.');
    }
}
