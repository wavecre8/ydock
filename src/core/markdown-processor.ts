import { PathParser } from './path-parser';
import { RenderContext } from './render-context';
import { DocDockConstants } from './constants';
import { ModeStrategy } from '../modes/types';
import { GenericStrategy } from '../modes/generic';

export interface ResolvedLinkInfo {
    prefix?: string;
    segments?: string[];
    isPropertiesBlock?: boolean;
    targetPage?: string;
}

export type LinkResolverFn = {
    (target: string | string[], explicitDoc?: string): string | undefined;
    resolve?: (target: string | string[], explicitDoc?: string) => ResolvedLinkInfo;
};

export type DocPrefixOption =
    | string
    | LinkResolverFn
    | ((target: string | string[], explicitDoc?: string) => string | undefined);

export class MarkdownProcessor {
    private static readonly LINK_CLASS = 'text-blue-600 hover:text-blue-800 underline';
    private static readonly DEFAULT_STRATEGY: ModeStrategy = new GenericStrategy();

    private static escapeAttr(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // マークダウンテキストを解析してHTMLへ変換
    static render(text: string, docPrefix?: DocPrefixOption, strategy?: ModeStrategy): string {
        if (typeof text !== 'string') return text;

        let result = '';
        let i = 0;

        while (i < text.length) {
            if (text[i] === '[') {
                // 角括弧終端位置の探索
                let labelEnd = -1;
                let j = i + 1;
                while (j < text.length) {
                    if (text[j] === '\\' && j + 1 < text.length) {
                        j += 2;
                        continue;
                    }
                    if (text[j] === ']') {
                        labelEnd = j;
                        break;
                    }
                    j++;
                }

                if (labelEnd !== -1 && labelEnd + 1 < text.length && text[labelEnd + 1] === '(') {
                    // ネスト深度追跡による丸括弧終端位置の探索
                    let depth = 1;
                    let urlEnd = -1;
                    let inQuote: string | null = null;
                    let k = labelEnd + 2;

                    while (k < text.length) {
                        const char = text[k];
                        if (char === '\\' && k + 1 < text.length) {
                            k += 2;
                            continue;
                        }
                        if (inQuote) {
                            if (char === inQuote) inQuote = null;
                        } else if (char === '"' || char === "'") {
                            inQuote = char;
                        } else if (char === '(') {
                            depth++;
                        } else if (char === ')') {
                            depth--;
                            if (depth === 0) {
                                urlEnd = k;
                                break;
                            }
                        }
                        k++;
                    }

                    if (urlEnd !== -1) {
                        const rawLabel = text.substring(i + 1, labelEnd);
                        const rawUrl = text.substring(labelEnd + 2, urlEnd);
                        const escapedLabel = this.escapeAttr(rawLabel);

                        // リンク要素のHTMLアンカー文字列生成
                        const formattedLink = this.formatLink(escapedLabel, rawUrl, docPrefix, strategy);
                        if (formattedLink !== null) {
                            result += formattedLink;
                            i = urlEnd + 1;
                            continue;
                        }
                    }
                }
            }

            // 非リンク文字列のHTMLエスケープ処理
            result += this.escapeAttr(text[i]);
            i++;
        }

        return result;
    }

    // リンク種別に応じたHTMLアンカータグの生成
    private static formatLink(
        escapedLabel: string,
        rawUrl: string,
        docPrefix?: DocPrefixOption,
        strategy?: ModeStrategy
    ): string | null {
        // 外部リンクの判定
        if (/^https?:\/\//.test(rawUrl)) {
            return `<a href="${this.escapeAttr(rawUrl)}" target="_blank" rel="noopener noreferrer" class="${this.LINK_CLASS}">${escapedLabel}</a>`;
        }

        // プロトコルリンクまたは相対パスの判定
        if (/^(?:ftp|mailto|file):/.test(rawUrl) || /^(?:\.?\.?\/)/.test(rawUrl)) {
            return `<a href="${this.escapeAttr(rawUrl)}" class="${this.LINK_CLASS}">${escapedLabel}</a>`;
        }

        // アンカーリンクの判定
        if (rawUrl.startsWith('#')) {
            return `<a href="${this.escapeAttr(rawUrl)}" class="${this.LINK_CLASS}">${escapedLabel}</a>`;
        }

        // 内部ナビゲーションパスの解決処理
        try {
            let targetPath = rawUrl;
            let explicitDoc: string | undefined;

            const scopeSeparatorIndex = rawUrl.indexOf('::');
            // スコープ区切り文字の検出とドキュメント識別子の抽出
            if (scopeSeparatorIndex !== -1) {
                explicitDoc = rawUrl.substring(0, scopeSeparatorIndex);
                targetPath = rawUrl.substring(scopeSeparatorIndex + 2);
            }

            const tokens = PathParser.parse(targetPath);
            const segments: string[] = [];
            for (const t of tokens) {
                if (t.type === 'prop') {
                    segments.push(t.name);
                } else if (t.type === 'match') {
                    segments.push(t.value === '' ? `[${t.key}]` : `[${t.key}=${t.value}]`);
                } else if (t.type === 'array') {
                    segments.push('[]');
                }
            }
            // リソースプロパティ階層判定および接頭辞解決
            let isPropertiesBlock = false;
            let resolvedPrefix: string | undefined;

            // リンク解決関数によるドキュメント接頭辞およびセグメント解決
            let targetPage: string | undefined;
            if (typeof docPrefix === 'function') {
                const resolverWithDetail = docPrefix as LinkResolverFn;
                if (typeof resolverWithDetail.resolve === 'function') {
                    // 詳細リンク解決関数によるセグメント補完の実行
                    const detail = resolverWithDetail.resolve(segments, explicitDoc);
                    resolvedPrefix = detail.prefix;
                    targetPage = detail.targetPage;
                    if (detail.segments && detail.segments.length > 0) {
                        segments.length = 0;
                        segments.push(...detail.segments);
                    }
                    if (detail.isPropertiesBlock !== undefined) {
                        isPropertiesBlock = detail.isPropertiesBlock;
                    }
                } else {
                    resolvedPrefix =
                        resolverWithDetail(segments, explicitDoc) ?? resolverWithDetail(segments[0], explicitDoc);
                }
            } else if (typeof docPrefix === 'string') {
                resolvedPrefix = docPrefix;
            } else if (explicitDoc) {
                targetPage = explicitDoc.endsWith('.html') ? explicitDoc : `${explicitDoc}.html`;
                // リゾルバー非提供時の指定戦略に基づく省略セグメント補完処理
                const activeStrategy = strategy || this.DEFAULT_STRATEGY;
                if (activeStrategy.completeOmittedSegments) {
                    const completed = activeStrategy.completeOmittedSegments(segments);
                    segments.length = 0;
                    segments.push(...completed.segments);
                    if (completed.isPropertiesBlock) {
                        isPropertiesBlock = true;
                    }
                }
            }

            // 詳細解決関数で判定未確定時のフォールバック処理
            if (!isPropertiesBlock && segments.length >= 3) {
                const activeStrategy = strategy || this.DEFAULT_STRATEGY;
                if (activeStrategy.isResourceSection && activeStrategy.isResourceSection(segments[0])) {
                    const propertiesKey = activeStrategy.getPropertiesKey
                        ? activeStrategy.getPropertiesKey()
                        : DocDockConstants.Cfn.PropertiesKey;
                    const knownAttributes = [
                        DocDockConstants.Cfn.TypeKey,
                        ...(activeStrategy.getAttributes ? activeStrategy.getAttributes() : [])
                    ];
                    if (segments[2] !== propertiesKey && !knownAttributes.includes(segments[2])) {
                        isPropertiesBlock = true;
                    }
                }
            }

            // ドキュメントスコープを反映したRenderContextの生成
            const ctx = RenderContext.create(segments, isPropertiesBlock, resolvedPrefix);
            const id = ctx.path;
            const href = targetPage ? `${targetPage}#${id}` : `#${id}`;
            return `<a href="${href}" class="${this.LINK_CLASS}">${escapedLabel}</a>`;
        } catch {
            return null;
        }
    }
}
