import * as fs from 'fs';
import * as path from 'path';
import { ModeFactory } from '../modes/factory';
import { PageConfig, TemplateData, GuideData, DocDockDocument, ExcludeTree } from '../types';
import { SourceProcessor } from './source-processor';
import { Generator } from './generator';
import { Logger } from './logger';
import { PathUtils } from './path-utils';

export class PageBuilder {
    /**
     * Generate a single page document
     * @param page Page configuration
     * @param globalMode Global mode setting
     * @param language Output language
     * @param configPath Path to the config file
     * @param layoutPath Path to the layout template
     * @param silent Whether to suppress logs
     */
    static async build(
        page: PageConfig,
        globalMode: 'cfn' | 'generic',
        language: string,
        configPath: string,
        layoutPath: string,
        silent?: boolean
    ): Promise<void> {
        const configDir = PathUtils.getConfigDir(configPath);
        const resolvedOutput = PathUtils.resolveRelative(configDir, page.output);

        Logger.info(`Generating ${resolvedOutput}...`);

        let accumulatedTemplate: TemplateData = {};
        let accumulatedGuide: GuideData = {};
        let accumulatedExcludeTree: ExcludeTree = {};
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
                accumulatedExcludeTree,
                silent
            );

            accumulatedTemplate = result.template;
            accumulatedGuide = result.guide;
            accumulatedExcludeTree = result.excludeTree;
        }

        if (descriptionList.length > 0) {
            accumulatedTemplate.Description = descriptionList;
        }

        const doc: DocDockDocument = {
            template: accumulatedTemplate,
            description: accumulatedGuide,
            excludeTree: accumulatedExcludeTree,
            mode: pageMode
        };

        const html = Generator.generate(doc, layoutPath, strategy, page.title, language);

        const outputDir = path.dirname(resolvedOutput);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(resolvedOutput, html, 'utf8');
        Logger.info(`  Preview: ${path.resolve(resolvedOutput)}`);
    }
}
