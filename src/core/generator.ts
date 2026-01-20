import * as ejs from 'ejs';
import * as fs from 'fs';
import * as path from 'path';
import { DocDockDocument } from '../types';
import { ModeStrategy } from '../modes/types';
import { TemplateRenderer } from './renderer';
import { DocDockConstants } from './constants';
import { MarkdownProcessor } from './markdown-processor';
import { HtmlComponents } from './html-components';

export class Generator {
    static generate(
        doc: DocDockDocument,
        templatePath: string,
        strategy: ModeStrategy,
        title: string = 'YAML Documentation',
        language: string = 'ja'
    ): string {
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        const renderer = new TemplateRenderer(strategy);

        const IGNORED_SECTIONS = strategy.getIgnoredSections();
        const renderableSections = Object.keys(doc.template).filter((key) => {
            if (IGNORED_SECTIONS.includes(key)) return false;

            const guideSection = doc.description?.[key];
            const meta = renderer.extractMetadata(guideSection);
            return !meta.hidden;
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
                doc,
                title,
                language,
                constants: DocDockConstants,
                strategy,
                renderableSections,
                extractMetadata: renderer.extractMetadata.bind(renderer),
                renderMarkdownClient: MarkdownProcessor.render.bind(MarkdownProcessor),
                renderTooltip: HtmlComponents.renderTooltip.bind(HtmlComponents),
                renderAliasedKey: HtmlComponents.renderAliasedKey.bind(HtmlComponents),
                isIntrinsic: renderer.isIntrinsic.bind(renderer),
                renderFlow: renderer.renderFlow.bind(renderer),
                renderValue: renderer.renderValue.bind(renderer)
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

        if (fs.existsSync(cssPath)) {
            const cssContent = fs.readFileSync(cssPath, 'utf8');
            finalHtml = finalHtml.replace('/* INJECT_CSS_PLACEHOLDER */', cssContent);
        }

        if (fs.existsSync(jsPath)) {
            const jsContent = fs.readFileSync(jsPath, 'utf8');
            finalHtml = finalHtml.replace('// INJECT_JS_PLACEHOLDER', jsContent);
        }

        return finalHtml;
    }
}
