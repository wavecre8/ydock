import * as fs from 'fs';
import * as path from 'path';
import { ModeFactory } from '../modes/factory';
import { PageConfig, TemplateData, DocDockDocument, SingleDocument } from '../types';
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
        globalMode: string,
        language: string,
        configPath: string,
        layoutPath: string,
        silent?: boolean,
        pageRouteMap?: Map<string, string>
    ): Promise<void> {
        const configDir = PathUtils.getConfigDir(configPath);
        const resolvedOutput = PathUtils.resolveRelative(configDir, page.output);

        Logger.info(`Generating ${resolvedOutput}...`);

        const pageMode = page.mode || globalMode;
        const strategy = ModeFactory.getStrategy(pageMode);

        const sources = page.sources || page.templates || [];
        if (sources.length === 0) {
            Logger.warn(`Page '${page.output}' does not define any sources or templates.`);
            return;
        }
        const documents: SingleDocument[] = [];

        // 各ソースファイルの独立処理とドキュメント配列への収集
        for (const sourcePath of sources) {
            const singleDoc = SourceProcessor.processSingle(sourcePath, strategy, page, configPath, silent);
            documents.push(singleDoc);
        }

        // 共通後方互換用テンプレートオブジェクトの参照設定
        const baseTemplate: TemplateData = documents[0]?.template || {};

        const doc: DocDockDocument = {
            template: baseTemplate,
            description: documents[0]?.description || {},
            excludeTree: documents[0]?.excludeTree || {},
            mode: pageMode,
            documents
        };

        const html = Generator.generate(doc, layoutPath, strategy, page.title, language, { pageRouteMap });

        const outputDir = path.dirname(resolvedOutput);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(resolvedOutput, html, 'utf8');
        Logger.info(`  Preview: ${path.resolve(resolvedOutput)}`);
    }
}
