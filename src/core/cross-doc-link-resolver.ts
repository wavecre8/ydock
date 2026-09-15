import * as path from 'path';
import { ModeStrategy } from '../modes/types';
import { LinkResolverFn } from './markdown-processor';
import { IndexedDocument, DocumentIndex } from './document-index';
import { Logger } from './logger';
import { PathParser } from './path-parser';

export interface LinkResolutionDetail {
    prefix: string | undefined;
    segments: string[];
    isPropertiesBlock?: boolean;
    targetPage?: string;
}

/**
 * 複数ドキュメント間での相互リンク解決および重複キー競合警告を制御するクラス
 */
export class CrossDocLinkResolver {
    private indexedDocs: IndexedDocument[];
    private isMultiDoc: boolean;
    private strategy: ModeStrategy;
    private pageRouteMap?: Map<string, string>;
    private warnedKeys = new Set<string>();
    private warnedScopes = new Set<string>();

    constructor(
        indexedDocs: IndexedDocument[],
        isMultiDoc: boolean,
        strategy: ModeStrategy,
        pageRouteMap?: Map<string, string>
    ) {
        this.indexedDocs = indexedDocs;
        this.isMultiDoc = isMultiDoc;
        this.strategy = strategy;
        this.pageRouteMap = pageRouteMap;
    }

    /**
     * 指定ターゲットに対するドキュメント横断リンク解決の詳細情報を導出
     */
    resolveLinkDetail(
        target: string | string[],
        currentDoc: IndexedDocument,
        explicitDoc?: string
    ): LinkResolutionDetail {
        const segments = Array.isArray(target) ? [...target] : PathParser.parseSegments(target);

        // 明示的なドキュメントスコープ指定が存在する場合の探索
        let scopedDoc: IndexedDocument | undefined;
        let targetPage: string | undefined = undefined;

        if (explicitDoc) {
            const explicitNorm = explicitDoc.replace(/\\/g, '/').toLowerCase();
            scopedDoc = this.indexedDocs.find((d) => {
                const baseName = d.rawDoc.sourceBaseName ? d.rawDoc.sourceBaseName.toLowerCase() : '';
                const filePath = d.rawDoc.sourcePath ? path.basename(d.rawDoc.sourcePath).toLowerCase() : '';
                const fullPath = d.rawDoc.sourcePath ? d.rawDoc.sourcePath.replace(/\\/g, '/').toLowerCase() : '';
                const ext = path.extname(fullPath);
                const fullPathWithoutExt = ext ? fullPath.slice(0, -ext.length) : fullPath;

                return (
                    d.currentDocPrefix.toLowerCase() === explicitNorm ||
                    baseName === explicitNorm ||
                    filePath === explicitNorm ||
                    fullPath === explicitNorm ||
                    fullPathWithoutExt === explicitNorm ||
                    fullPath.endsWith(`/${explicitNorm}`) ||
                    fullPathWithoutExt.endsWith(`/${explicitNorm}`)
                );
            });

            if (!scopedDoc) {
                // ページルーティングマップによるカレントページ外ドキュメントの逆引き
                if (this.pageRouteMap) {
                    const mappedPage = this.pageRouteMap.get(explicitNorm);
                    if (mappedPage) {
                        targetPage = mappedPage;
                    }
                }

                // 外部ページとして特定できた場合、単一ドキュメントページ、または明示的なhtml拡張子指定の場合のリンク生成
                if (targetPage || !this.isMultiDoc || explicitDoc.endsWith('.html')) {
                    if (!targetPage) {
                        // マッピングに存在しない場合の拡張子フォールバック
                        targetPage = explicitDoc.endsWith('.html') ? explicitDoc : `${explicitDoc}.html`;
                    }
                    // モード戦略に基づく省略セグメント補完処理
                    const completed = this.strategy.completeOmittedSegments
                        ? this.strategy.completeOmittedSegments(segments)
                        : { segments: [...segments], isPropertiesBlock: false };
                    return {
                        prefix: undefined,
                        segments: completed.segments,
                        isPropertiesBlock: completed.isPropertiesBlock,
                        targetPage
                    };
                }

                // マルチドキュメントページ内で明示的スコープ指定に合致するドキュメントが存在しない場合の警告通知
                const explicitNormKey = explicitDoc.toLowerCase();
                if (!this.warnedScopes.has(explicitNormKey)) {
                    this.warnedScopes.add(explicitNormKey);
                    Logger.warn(`Specified document scope '${explicitDoc}' was not found.`);
                }
                return { prefix: currentDoc.currentDocPrefix, segments };
            }
        }

        if (!this.isMultiDoc && !scopedDoc) {
            // 単一ドキュメントにおける短縮パス展開
            const expanded = DocumentIndex.expandShortSegments(currentDoc, segments);
            return {
                prefix: undefined,
                segments: expanded.segments,
                isPropertiesBlock: expanded.isPropertiesBlock
            };
        }

        const topLevelKey = segments[0] || '';
        const secondLevelKey = segments.length > 1 ? segments[1] : undefined;

        const topLower = topLevelKey.toLowerCase();
        const secondLower = secondLevelKey ? secondLevelKey.toLowerCase() : undefined;

        // スコープ指定ドキュメントまたは全ドキュメントを対象とした一致ドキュメント群の走査
        let resolvedDoc: IndexedDocument;
        if (scopedDoc) {
            resolvedDoc = scopedDoc;
        } else {
            // 一致するドキュメント群の探索実行
            const matches = DocumentIndex.findMatchingDocs(this.indexedDocs, topLower, secondLower);

            if (matches.length === 0) {
                const expanded = DocumentIndex.expandShortSegments(currentDoc, segments);
                return {
                    prefix: currentDoc.currentDocPrefix,
                    segments: expanded.segments,
                    isPropertiesBlock: expanded.isPropertiesBlock
                };
            }

            // 自ドキュメント優先を反映した解決先ドキュメントの先行決定
            const selfMatch = matches.find((m) => m.docIndex === currentDoc.docIndex);
            resolvedDoc = selfMatch || matches[0];

            // 複数ドキュメント間での重複キー競合を検知した場合は警告を出力
            if (matches.length >= 2) {
                const conflictKey = secondLevelKey ? `${topLevelKey}.${secondLevelKey}` : topLevelKey;
                const conflictKeyLower = conflictKey.toLowerCase();
                const warnEntryKey = `${currentDoc.docIndex}:${conflictKeyLower}`;
                if (!this.warnedKeys.has(warnEntryKey)) {
                    this.warnedKeys.add(warnEntryKey);
                    const docNames = matches.map((m) => m.rawDoc.sourceBaseName || m.currentDocPrefix).join(', ');
                    const resolvedName = resolvedDoc.rawDoc.sourceBaseName || resolvedDoc.currentDocPrefix;
                    Logger.warn(
                        `Key '${conflictKey}' is duplicated across multiple documents: ${docNames}. Resolved to '${resolvedName}'. Use scope prefix to target a specific document.`
                    );
                }
            }
        }

        // 解決先ドキュメントの階層構造に基づく短縮パス展開
        const expanded = DocumentIndex.expandShortSegments(resolvedDoc, segments);

        return {
            prefix: resolvedDoc.currentDocPrefix,
            segments: expanded.segments,
            isPropertiesBlock: expanded.isPropertiesBlock
        };
    }

    /**
     * 単一ドキュメント用のリンク解決関数の生成
     */
    createLinkResolver(currentDoc: IndexedDocument): LinkResolverFn {
        const resolver: LinkResolverFn = (target: string | string[], explicitDoc?: string): string | undefined => {
            // リンク解決詳細情報の導出
            const detail = this.resolveLinkDetail(target, currentDoc, explicitDoc);
            return detail.prefix;
        };
        resolver.resolve = (target: string | string[], explicitDoc?: string) => {
            // リンク解決詳細情報の導出
            return this.resolveLinkDetail(target, currentDoc, explicitDoc);
        };
        return resolver;
    }
}
