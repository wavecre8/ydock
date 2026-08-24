import * as ejs from 'ejs';
import * as fs from 'fs';
import * as path from 'path';
import { DocDockDocument } from '../types';
import { ModeStrategy } from '../modes/types';
import { TemplateRenderer } from './renderer';
import { DocDockConstants } from './constants';
import { MarkdownProcessor } from './markdown-processor';
import { HtmlComponents } from './html-components';
import { DocumentPreprocessor } from './document-preprocessor';
import { ConditionMatcher } from './condition-matcher';
import { RenderContext } from './render-context';

export interface GeneratorOptions {
    readFile?: (filePath: string) => string;
    fileExists?: (filePath: string) => boolean;
}

export class Generator {
    static generate(
        doc: DocDockDocument,
        templatePath: string,
        strategy: ModeStrategy,
        title: string = 'YAML Documentation',
        language: string = 'ja',
        options?: GeneratorOptions
    ): string {
        const readFile = options?.readFile || ((p) => fs.readFileSync(p, 'utf8'));
        const fileExists = options?.fileExists || ((p) => fs.existsSync(p));

        const templateContent = readFile(templatePath);
        const matcher = new ConditionMatcher(strategy, doc);
        const processedDoc = DocumentPreprocessor.process(doc, matcher);
        const renderer = new TemplateRenderer(strategy, processedDoc, matcher);

        const IGNORED_SECTIONS = strategy.getIgnoredSections();
        const renderableSections = Object.keys(processedDoc.template).filter((key) => {
            if (IGNORED_SECTIONS.includes(key)) return false;

            const guideSection = processedDoc.description?.[key];
            matcher.extractMetadata(guideSection);
            return true;
        });

        const SORT_ORDER = strategy.getSectionSortOrder();
        if (SORT_ORDER) {
            renderableSections.sort((a, b) => {
                const indexA = SORT_ORDER.indexOf(a);
                const indexB = SORT_ORDER.indexOf(b);

                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;

                return 0;
            });
        }

        // Normalize path for Windows compatibility with ejs
        const templateDir = path.dirname(templatePath).replace(/\\/g, '/');

        const html = ejs.render(
            templateContent,
            {
                doc: processedDoc,
                title,
                language,
                constants: DocDockConstants,
                strategy,
                renderableSections,
                extractMetadata: matcher.extractMetadata.bind(matcher),
                renderMarkdownClient: MarkdownProcessor.render.bind(MarkdownProcessor),
                renderTooltip: HtmlComponents.renderTooltip.bind(HtmlComponents),
                renderAliasedKey: HtmlComponents.renderAliasedKey.bind(HtmlComponents),
                escapeHtml: HtmlComponents.escape.bind(HtmlComponents),
                isIntrinsic: renderer.isIntrinsic.bind(renderer),
                renderFlow: (val: any) => renderer.renderFlow(val, new RenderContext(0)),
                renderValue: (val: any, desc: any, ctx: RenderContext) => renderer.renderValue(val, desc, ctx),
                createContext: RenderContext.create
            },
            {
                filename: templatePath,
                root: templateDir
            }
        );

        // Inject separated CSS/JS AFTER rendering to support placeholders in partials include
        let finalHtml = html;
        const cssPath = path.join(templateDir, 'style.css');
        const jsPath = path.join(templateDir, 'script.js');

        if (fileExists(cssPath)) {
            const cssContent = readFile(cssPath);
            finalHtml = finalHtml.replace('/* INJECT_CSS_PLACEHOLDER */', cssContent);
        }

        if (fileExists(jsPath)) {
            const jsContent = readFile(jsPath);
            finalHtml = finalHtml.replace('// INJECT_JS_PLACEHOLDER', jsContent);
        }

        return finalHtml;
    }
}
