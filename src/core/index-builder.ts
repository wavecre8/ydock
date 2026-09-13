import * as fs from 'fs';
import * as path from 'path';
import { DocDockConfig, PageConfig } from '../types';
import { DocDockConstants } from './constants';
import { Logger } from './logger';
import { PathUtils } from './path-utils';

export class IndexBuilder {
    /**
     * Generate index page that lists all documentation pages
     * @param config Full configuration
     * @param configPath Path to the config file
     * @param globalMode Global mode setting
     * @param language Output language
     * @param silent Whether to suppress logs
     */
    static async build(
        config: DocDockConfig,
        configPath: string,
        globalMode: string,
        language: string,
        _silent?: boolean
    ): Promise<void> {
        const indexConfig =
            typeof config.index === 'string' ? { output: config.index, title: undefined } : config.index;

        if (!indexConfig) return;

        const configDir = PathUtils.getConfigDir(configPath);
        const resolvedIndexOutput = PathUtils.resolveRelative(configDir, indexConfig.output);

        Logger.info(`Generating Index Page: ${resolvedIndexOutput}...`);
        const resolvedTemplatePath = path.join(__dirname, DocDockConstants.Defaults.TemplateIndex);
        
        const ejs = require('ejs');

        if (fs.existsSync(resolvedTemplatePath)) {
            const indexDir = path.dirname(resolvedIndexOutput);

            const pagesData = config.pages.map((page: PageConfig) => {
                const resolvedPageOutput = PathUtils.resolveRelative(configDir, page.output);

                let relativeLink = path.relative(indexDir, resolvedPageOutput);
                relativeLink = relativeLink.split(path.sep).join('/');

                const filename = path.basename(resolvedPageOutput);
                // ページタイトルのフォールバック導出
                const pageTitle = page.title || path.basename(resolvedPageOutput, path.extname(resolvedPageOutput));

                return {
                    title: pageTitle,
                    filename: filename,
                    link: relativeLink,
                    mode: page.mode || globalMode
                };
            });

            const indexHtml = await ejs.renderFile(resolvedTemplatePath, {
                pages: pagesData,
                language: language,
                title: indexConfig.title
            });

            if (!fs.existsSync(indexDir)) {
                fs.mkdirSync(indexDir, { recursive: true });
            }

            fs.writeFileSync(resolvedIndexOutput, indexHtml, 'utf8');
            Logger.info(`  Preview Index: ${path.resolve(resolvedIndexOutput)}`);
        } else {
            Logger.warn('Index template not found at ' + resolvedTemplatePath);
        }
    }
}
