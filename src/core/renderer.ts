import { ModeStrategy } from '../modes/types';
import { MarkdownProcessor, DocPrefixOption } from './markdown-processor';
import { HtmlComponents } from './html-components';
import { YamlValue, DocDockDocument } from '../types';
import { ConditionMatcher } from './condition-matcher';
import { RenderContext } from './render-context';

export class TemplateRenderer {
    private strategy: ModeStrategy;
    private doc?: DocDockDocument;
    private matcher: ConditionMatcher;
    private docPrefix?: DocPrefixOption;

    constructor(
        strategy: ModeStrategy,
        doc?: DocDockDocument,
        matcher?: ConditionMatcher,
        docPrefix?: DocPrefixOption
    ) {
        this.strategy = strategy;
        this.doc = doc;
        this.matcher = matcher || new ConditionMatcher(strategy, doc);
        this.docPrefix = docPrefix;
    }

    isIntrinsic(val: unknown): boolean {
        return this.strategy.isIntrinsic(val);
    }

    renderMarkdownClient(text: string): string {
        return MarkdownProcessor.render(text, this.docPrefix);
    }

    renderTooltip(descText: string | undefined): string {
        return HtmlComponents.renderTooltip(descText, this.docPrefix);
    }

    renderAliasedKey(key: string | number, alias: string | undefined): string {
        return HtmlComponents.renderAliasedKey(key, alias);
    }

    renderFlow(val: YamlValue, ctx: RenderContext): string {
        if (val === undefined || val === null) return '';

        if (this.matcher.isPrimitive(val)) {
            return HtmlComponents.renderFlowPrimitive(val);
        }

        if (this.isIntrinsic(val)) {
            const obj = val as Record<string, YamlValue>;
            const key = Object.keys(obj)[0];
            const innerVal = obj[key];
            const innerHtml = this.renderFlow(innerVal, ctx.child());
            return HtmlComponents.renderFlowIntrinsic(key, innerHtml);
        }

        if (Array.isArray(val)) {
            const itemsHtml = val
                .map((item) => this.renderFlow(item, ctx.child(undefined, undefined, true)))
                .join('<span class="text-slate-400 mx-1">,</span>');
            return HtmlComponents.renderFlowArray(itemsHtml);
        }

        if (typeof val === 'object') {
            const pairsHtml = Object.entries(val)
                .map(([k, v]) => {
                    const escapedKey = HtmlComponents.escape(k);
                    return `<span><span class="text-slate-500">${escapedKey}:</span> ${this.renderFlow(v, ctx.child(undefined, undefined, true))}</span>`;
                })
                .join('<span class="text-slate-400 mx-1">,</span>');
            return HtmlComponents.renderFlowObject(pairsHtml);
        }

        return JSON.stringify(val);
    }

    renderValue(val: YamlValue, desc: YamlValue, ctx: RenderContext): string {
        if (val === undefined || val === null) return '';

        if (this.matcher.isPrimitive(val)) {
            return this.renderPrimitive(val);
        }

        if (this.isIntrinsic(val)) {
            return this.renderIntrinsic(val as Record<string, YamlValue>, ctx);
        }

        if (Array.isArray(val)) {
            return this.renderArray(val, desc, ctx);
        }

        if (typeof val === 'object') {
            return this.renderObjectAsTable(val as Record<string, YamlValue>, desc, ctx);
        }

        return JSON.stringify(val);
    }

    private renderPrimitive(val: unknown): string {
        return HtmlComponents.renderPrimitive(val);
    }

    private renderIntrinsic(val: Record<string, YamlValue>, ctx: RenderContext): string {
        const key = Object.keys(val)[0];
        const innerVal = val[key];

        if (Array.isArray(innerVal) || (typeof innerVal === 'object' && innerVal !== null)) {
            const innerHtml = this.renderFlow(innerVal, ctx);
            return HtmlComponents.renderIntrinsicInline(key, innerHtml);
        }

        const innerCtx = ctx.child(key, key, false);
        const innerHtml = this.renderValue(innerVal, null, innerCtx);
        return HtmlComponents.renderIntrinsicBlock(key, innerHtml);
    }

    private renderArray(val: YamlValue[], desc: YamlValue, ctx: RenderContext): string {
        if (val.length === 0) return '';

        const allPrimitives = val.every((item) => this.matcher.isPrimitive(item));

        if (allPrimitives) {
            return this.renderPrimitiveArray(val, desc, ctx);
        } else {
            return this.renderComplexArray(val, desc, ctx);
        }
    }

    private renderPrimitiveArray(val: YamlValue[], desc: YamlValue, ctx: RenderContext): string {
        const seenSegments = new Set<string>();
        const rowsHtml = val
            .map((item, i) => {
                // ガイド情報の取得
                const itemDesc = this.matcher.findMatchingGuide(item, desc, i, ctx.rawPath);
                // ガイド情報からのメタデータ抽出
                const meta = this.matcher.extractMetadata(itemDesc);
                const descText = meta.description || '';

                // 一意なセグメント識別子の導出
                const { segment, baseSegment } = this.matcher.deriveUniqueSegment(
                    item,
                    desc,
                    i,
                    (s) => seenSegments.has(s),
                    ctx.rawPath
                );
                seenSegments.add(segment);
                // 子描画コンテキストの生成
                const itemCtx = ctx.child(segment, baseSegment || segment, false);

                // ツールチップ表示HTMLの生成
                const tooltipHtml = this.renderTooltip(descText);
                // インライン説明表示HTMLの生成
                const inlineDescHtml = descText
                    ? HtmlComponents.renderPrimitiveInlineDescription(this.renderMarkdownClient(descText))
                    : '';

                // スカラー配列行HTMLの生成
                return HtmlComponents.renderPrimitiveArrayRow(
                    itemCtx.path || '',
                    item,
                    tooltipHtml,
                    inlineDescHtml,
                    meta.alias
                );
            })
            .join('');

        // スカラー配列テーブル全体の生成
        return HtmlComponents.renderPrimitiveArrayTable(rowsHtml);
    }

    private renderComplexArray(val: YamlValue[], desc: YamlValue, ctx: RenderContext): string {
        const seenSegments = new Set<string>();
        const itemsHtml = val
            .map((item, i) => {
                // ガイド情報の取得
                const itemDesc = this.matcher.findMatchingGuide(item, desc, i, ctx.rawPath);
                // ガイド情報からのメタデータ抽出
                const meta = this.matcher.extractMetadata(itemDesc);

                // 一意なセグメント識別子の導出
                const { segment, baseSegment } = this.matcher.deriveUniqueSegment(
                    item,
                    desc,
                    i,
                    (s) => seenSegments.has(s),
                    ctx.rawPath
                );
                seenSegments.add(segment);
                // 子描画コンテキストの生成
                const itemCtx = ctx.child(segment, baseSegment || segment, false);

                // 配列要素値のレンダリング
                const innerHtml = this.renderValue(item, itemDesc, itemCtx);
                // 複合配列要素カードの生成
                return HtmlComponents.renderComplexArrayItem(
                    itemCtx.path || '',
                    String(i),
                    innerHtml,
                    meta.alias,
                    meta.description,
                    this.docPrefix
                );
            })
            .join('');

        // 複合配列コンテナ全体の生成
        return HtmlComponents.renderComplexArrayContainer(itemsHtml);
    }

    private renderObjectAsTable(val: Record<string, YamlValue>, desc: YamlValue, ctx: RenderContext): string {
        const keys = Object.keys(val);
        if (keys.length === 0) return '{}';

        const rowsHtml = keys
            .map((key) => {
                const subVal = val[key];
                const subDesc =
                    typeof desc === 'object' && desc !== null && !Array.isArray(desc)
                        ? (desc as Record<string, YamlValue>)[key]
                        : undefined;
                const meta = this.matcher.extractMetadata(subDesc);

                const descText = meta.description;
                const alias = meta.alias;

                const itemCtx = ctx.child(key, key, true);

                const keyHtml = this.renderAliasedKey(key, alias);
                const valHtml = this.renderValue(subVal, subDesc, itemCtx);
                const tooltipHtml = this.renderTooltip(descText);
                const inlineDescHtml = descText
                    ? HtmlComponents.renderInlineDescription(this.renderMarkdownClient(descText))
                    : '';

                return HtmlComponents.renderObjectRow(
                    itemCtx.path || '',
                    itemCtx.copyPath,
                    keyHtml,
                    valHtml,
                    tooltipHtml,
                    inlineDescHtml
                );
            })
            .join('');

        return HtmlComponents.renderObjectTable(ctx.level, rowsHtml);
    }
}
