import * as fs from 'fs';
import * as path from 'path';
import { Loader } from './loader';
import { Generator } from './generator';
import { ModeFactory } from '../modes/factory';
import { DocDockConfig, PageConfig, TemplateData, GuideData, DocDockDocument } from '../types';
import { SourceProcessor } from './source-processor';

export interface BuildOptions {
    configPath: string;
    silent?: boolean;
}

export class DocDockBuilder {
    static async build(options: BuildOptions): Promise<void> {
        if (!options.silent) console.log(`Loading config from ${options.configPath}...`);

        const config = Loader.loadConfig(options.configPath) as DocDockConfig;
        const globalMode = config.mode || 'generic';
        const language = config.lang || 'ja';
        const layoutPath = path.join(__dirname, '../templates/layout.ejs');

        for (const page of config.pages) {
            await this.generatePage(page, globalMode, language, options.configPath, layoutPath, options.silent);
        }

        if (config.index) {
            await this.generateIndexPage(config, globalMode, language, options.silent);
        }

        if (!options.silent) console.log('Build complete.');
    }

    /**
     * Generate a single page document
     * @param page Page configuration
     * @param globalMode Global mode setting
     * @param language Output language
     * @param configPath Path to the config file
     * @param layoutPath Path to the layout template
     */
    private static async generatePage(
        page: PageConfig,
        globalMode: 'cfn' | 'generic',
        language: string,
        configPath: string,
        layoutPath: string,
        silent?: boolean
    ): Promise<void> {
        if (!silent) console.log(`Generating ${page.output}...`);

        let accumulatedTemplate: TemplateData = {};
        let accumulatedGuide: GuideData = {};
        const seenKeys = new Set<string>();

        const pageMode = page.mode || globalMode;
        const strategy = ModeFactory.getStrategy(pageMode);

        const sources = page.sources || page.templates || [];
        const descriptionList: Array<{ fileName: string; content: string }> = [];

        for (const sourcePath of sources) {
            const result = SourceProcessor.process(
                sourcePath,
                strategy,
                page,
                configPath,
                seenKeys,
                descriptionList,
                accumulatedTemplate,
                accumulatedGuide,
                silent
            );

            accumulatedTemplate = result.template;
            accumulatedGuide = result.guide;
        }

        if (descriptionList.length > 0) {
            accumulatedTemplate.Description = descriptionList;
        }

        const doc: DocDockDocument = {
            template: accumulatedTemplate,
            description: accumulatedGuide,
            mode: pageMode
        };

        const html = Generator.generate(doc, layoutPath, strategy, page.title, language);

        const outputDir = path.dirname(page.output);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(page.output, html);
        if (!silent) console.log(`  Preview: ${path.resolve(page.output)}`);
    }

    /**
     * Generate index page that lists all documentation pages
     * @param config Full configuration
     * @param globalMode Global mode setting
     * @param language Output language
     */
    private static async generateIndexPage(
        config: DocDockConfig,
        globalMode: string,
        language: string,
        silent?: boolean
    ): Promise<void> {
        const indexConfig =
            typeof config.index === 'string' ? { output: config.index, title: undefined } : config.index;

        if (!indexConfig) return;

        if (!silent) console.log(`Generating Index Page: ${indexConfig.output}...`);
        const indexTemplatePath = path.join(__dirname, '../templates/index.ejs');
        const ejs = require('ejs');

        if (fs.existsSync(indexTemplatePath)) {
            const indexDir = path.dirname(indexConfig.output);

            const pagesData = config.pages.map((page: PageConfig) => {
                let relativeLink = path.relative(indexDir, page.output);
                relativeLink = relativeLink.split(path.sep).join('/');

                return {
                    title: page.title,
                    filename: path.basename(page.output),
                    link: relativeLink,
                    mode: page.mode || globalMode
                };
            });

            const indexHtml = await ejs.renderFile(indexTemplatePath, {
                pages: pagesData,
                language: language,
                title: indexConfig.title
            });

            if (!fs.existsSync(indexDir)) {
                fs.mkdirSync(indexDir, { recursive: true });
            }

            fs.writeFileSync(indexConfig.output, indexHtml);
            if (!silent) console.log(`  Preview Index: ${path.resolve(indexConfig.output)}`);
        } else {
            console.warn('Index template not found at ' + indexTemplatePath);
        }
    }
}
