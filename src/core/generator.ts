import * as ejs from 'ejs';
import * as fs from 'fs';
import * as path from 'path';
import { DocDockDocument, SingleDocument } from '../types';
import { ModeStrategy } from '../modes/types';
import { TemplateRenderer } from './renderer';
import { DocDockConstants } from './constants';
import { MarkdownProcessor, DocPrefixOption } from './markdown-processor';
import { HtmlComponents } from './html-components';
import { RenderContext } from './render-context';
import { HtmlMinifier } from './html-minifier';
import { DocumentIndex } from './document-index';
import { CrossDocLinkResolver } from './cross-doc-link-resolver';

export interface GeneratorOptions {
    readFile?: (filePath: string) => string;
    fileExists?: (filePath: string) => boolean;
    pageRouteMap?: Map<string, string>;
}

export class Generator {
    static generate(
        doc: DocDockDocument,
        templatePath: string,
        strategy: ModeStrategy,
        title: string = DocDockConstants.Defaults.Title,
        language: string = DocDockConstants.Defaults.Language,
        options?: GeneratorOptions
    ): string {
        const readFile = options?.readFile || ((p) => fs.readFileSync(p, 'utf8'));
        const fileExists = options?.fileExists || ((p) => fs.existsSync(p));

        const templateContent = readFile(templatePath);

        const IGNORED_SECTIONS = (strategy.getIgnoredSections && strategy.getIgnoredSections()) || [];
        const SORT_ORDER = strategy.getSectionSortOrder();

        // セクションの表示順序ソート関数
        const sortSections = (sections: string[]): string[] => {
            if (!SORT_ORDER) return sections;
            return [...sections].sort((a, b) => {
                const indexA = SORT_ORDER.indexOf(a);
                const indexB = SORT_ORDER.indexOf(b);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return 0;
            });
        };

        // 直列ドキュメント配列の正規化
        const rawDocuments: SingleDocument[] =
            doc.documents && doc.documents.length > 0
                ? doc.documents
                : [
                      {
                          sourcePath: '',
                          sourceBaseName: '',
                          template: doc.template,
                          description: doc.description,
                          excludeTree: doc.excludeTree
                      }
                  ];

        // 全ドキュメントのトップレベルキー情報の収集と複数ドキュメント判定
        const isMultiDoc = rawDocuments.length > 1;

        // ドキュメントごとのインデックス構築
        const preparedDocs = rawDocuments.map((rawDoc, docIndex) =>
            DocumentIndex.indexDocument(rawDoc, docIndex, isMultiDoc, doc, strategy, sortSections, IGNORED_SECTIONS)
        );

        // ドキュメント横断リンク解決器の初期化
        const crossDocResolver = new CrossDocLinkResolver(preparedDocs, isMultiDoc, strategy, options?.pageRouteMap);

        // 各ドキュメントに対するレンダラーおよびリンク解決関数のバインド
        const processedDocuments = preparedDocs.map((item) => {
            // 単一ドキュメント用リンク解決関数の取得
            const linkResolver = crossDocResolver.createLinkResolver(item);
            const docRenderer = new TemplateRenderer(strategy, item.processedSingleDoc, item.docMatcher, linkResolver);

            return {
                docIndex: item.docIndex,
                docPrefix: item.currentDocPrefix,
                linkResolver,
                sourcePath: item.rawDoc.sourcePath,
                sourceBaseName: item.rawDoc.sourceBaseName,
                doc: item.processedSingleDoc,
                renderableSections: item.singleSections,
                matcher: item.docMatcher,
                renderer: docRenderer
            };
        });

        // 先頭ドキュメントに基づく互換用変数の参照
        const primaryDoc = processedDocuments[0];
        const processedDoc = primaryDoc.doc;
        const renderableSections = primaryDoc.renderableSections;
        const primaryRenderer = primaryDoc.renderer;

        // Normalize path for Windows compatibility with ejs
        const templateDir = path.dirname(templatePath).replace(/\\/g, '/');

        const html = ejs.render(
            templateContent,
            {
                doc: processedDoc,
                processedDocuments,
                title,
                language,
                constants: DocDockConstants,
                strategy,
                renderableSections,
                extractMetadata: primaryDoc.matcher.extractMetadata.bind(primaryDoc.matcher),
                renderMarkdownClient: (text: string, docPrefix?: DocPrefixOption) =>
                    MarkdownProcessor.render(text, docPrefix, strategy),
                renderTooltip: (descText: string | undefined, docPrefix?: DocPrefixOption) =>
                    HtmlComponents.renderTooltip(descText, docPrefix),
                renderAliasedKey: HtmlComponents.renderAliasedKey.bind(HtmlComponents),
                escapeHtml: HtmlComponents.escape.bind(HtmlComponents),
                isIntrinsic: primaryRenderer.isIntrinsic.bind(primaryRenderer),
                renderFlow: (val: any) => primaryRenderer.renderFlow(val, new RenderContext(0)),
                renderValue: (val: any, desc: any, ctx: RenderContext) => primaryRenderer.renderValue(val, desc, ctx),
                RenderContext,
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
            // 特殊パターンの展開を防止したCSS埋め込み処理
            finalHtml = finalHtml.replace('/* INJECT_CSS_PLACEHOLDER */', () => cssContent);
        }

        if (fileExists(jsPath)) {
            const jsContent = readFile(jsPath);
            // 特殊パターンの展開を防止したJavaScript埋め込み処理
            finalHtml = finalHtml.replace('// INJECT_JS_PLACEHOLDER', () => jsContent);
        }

        // 生成HTMLに対する空白および改行の安全な圧縮処理
        return HtmlMinifier.minify(finalHtml);
    }
}
