import * as path from 'path';
import { Loader } from './loader';
import { DocDockConfig } from '../types';
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
        const globalMode = config.mode || DocDockConstants.Defaults.Mode;
        const language = config.lang || DocDockConstants.Defaults.Language;
        const layoutPath = path.join(__dirname, DocDockConstants.Defaults.TemplateLayout);

        for (const page of config.pages) {
            await PageBuilder.build(page, globalMode as 'cfn' | 'generic', language, resolvedConfigPath, layoutPath, options.silent);
        }

        if (config.index) {
            await IndexBuilder.build(config, resolvedConfigPath, globalMode, language, options.silent);
        }

        Logger.info('Build complete.');
    }
}
