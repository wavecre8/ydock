import { MarkdownProcessor, DocPrefixOption } from './markdown-processor';
import { DocDockConstants } from './constants';

export class HtmlComponents {
    static escape(val: unknown): string {
        if (val === null || val === undefined) return '';
        const text = typeof val === 'string' ? val : String(val);
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    static renderTooltip(descText: string | undefined, docPrefix?: DocPrefixOption): string {
        if (!descText) return '';
        // 共通SVGシンボルを参照するツールチップ構造の生成
        const content =
            docPrefix !== undefined
                ? MarkdownProcessor.render(descText, docPrefix)
                : MarkdownProcessor.render(descText);
        return `<span class="elem-tooltip tooltip-container flex-shrink-0 pt-1"><div class="tooltip-wrapper"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 text-blue-500"><use href="#icon-info"></use></svg></div><div class="tooltip-content">${content}<div class="tooltip-arrow"></div></div></span>`;
    }

    static renderAliasedKey(key: string | number, alias: string | undefined): string {
        const escapedKey = this.escape(key);
        if (!alias) return escapedKey;
        const escapedAlias = this.escape(alias);
        return `<span class="text-slate-700 block">${escapedKey}</span><span class="alias-wrapper"><span class="alias-text">${escapedAlias}</span></span>`;
    }

    static renderPrimitive(val: unknown): string {
        return `<span class="${DocDockConstants.CssClasses.PropertyValue}">${this.escape(val)}</span>`;
    }

    static renderFlowPrimitive(val: unknown): string {
        return `<span class="${DocDockConstants.CssClasses.PropertyValue} font-mono text-slate-700">${this.escape(val)}</span>`;
    }

    static renderFlowIntrinsic(key: string, innerHtml: string): string {
        return `<div class="inline-flex items-start gap-1 align-top">
            <span class="${DocDockConstants.CssClasses.BadgeFn} text-[10px] sm:text-xs">${this.escape(key)}</span>
            <span>${innerHtml}</span>
        </div>`;
    }

    static renderFlowArray(itemsHtml: string): string {
        return `<span class="font-mono text-slate-600 inline-flex flex-wrap items-center gap-y-1">
            <span class="text-slate-400 mr-1">[</span>${itemsHtml}<span class="text-slate-400 ml-1">]</span>
        </span>`;
    }

    static renderFlowObject(pairsHtml: string): string {
        return `<span class="font-mono text-slate-600 inline-flex flex-wrap items-center gap-y-1">
            <span class="text-slate-400 mr-1">{</span>${pairsHtml}<span class="text-slate-400 ml-1">}</span>
        </span>`;
    }

    static renderIntrinsicInline(key: string, innerHtml: string): string {
        return `<div class="flex items-start gap-2 flex-wrap">
            <span class="${DocDockConstants.CssClasses.BadgeFn} flex-shrink-0">${this.escape(key)}</span> 
            ${innerHtml}
        </div>`;
    }

    static renderIntrinsicBlock(key: string, innerHtml: string): string {
        return `<div class="flex items-start gap-2"><span class="${DocDockConstants.CssClasses.BadgeFn}">${this.escape(key)}</span> <span>${innerHtml}</span></div>`;
    }

    static renderPrimitiveArrayTable(rowsHtml: string): string {
        return `<table class="${DocDockConstants.CssClasses.TableBase} ${DocDockConstants.CssClasses.NestedTable} text-sm bg-white">
            <thead>
                <tr>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>`;
    }

    static renderPrimitiveArrayRow(
        myPath: string,
        itemVal: unknown,
        tooltipHtml: string,
        inlineDescHtml: string,
        alias?: string
    ): string {
        // 値のHTMLエスケープ処理
        const escapedVal = this.escape(itemVal);
        const valHtml = alias
            ? `<span class="${DocDockConstants.CssClasses.PropertyValue}">${escapedVal}</span><span class="alias-wrapper"><span class="alias-text">${this.escape(alias)}</span></span>`
            : `<span class="${DocDockConstants.CssClasses.PropertyValue}">${escapedVal}</span>`;

        return `<tr id="${myPath}" class="${DocDockConstants.CssClasses.HoverRow} scroll-mt-20">
            <td class="align-top">
                <div class="flex items-start">
                    <div class="flex-grow">${valHtml}</div>
                    ${tooltipHtml}
                </div>
                ${inlineDescHtml}
            </td>
        </tr>`;
    }

    static renderComplexArrayContainer(itemsHtml: string): string {
        return `<div class="flex flex-col gap-4 mt-2">
            ${itemsHtml}
        </div>`;
    }

    static renderComplexArrayItem(
        myPath: string,
        indexStr: string,
        innerHtml: string,
        alias?: string,
        descText?: string,
        docPrefix?: DocPrefixOption
    ): string {
        // ツールチップ表示HTMLの生成
        const tooltipHtml = this.renderTooltip(descText, docPrefix);
        const headerTitle = alias ? `# ${this.escape(indexStr)}: ${this.escape(alias)}` : `# ${this.escape(indexStr)}`;

        return `<div id="${myPath}" class="border border-slate-200 rounded-md overflow-hidden scroll-mt-20">
            <div class="bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500 border-b border-slate-200 flex items-center justify-between">
                <span class="break-all">${headerTitle}</span>
                ${tooltipHtml}
            </div>
            <div class="p-2 bg-white">
                ${innerHtml}
            </div>
        </div>`;
    }

    static renderObjectTable(level: number, rowsHtml: string): string {
        return `<table class="${DocDockConstants.CssClasses.TableBase} ${DocDockConstants.CssClasses.NestedTable} text-sm bg-white">
            <colgroup>
                <col style="width: var(--col-width-level-${level}, var(--col-width-level-default));">
                <col>
            </colgroup>
            <thead>
                <tr>
                    <th class="relative">
                        Property
                        <div class="${DocDockConstants.CssClasses.ColResizer}" data-level="${level}"></div>
                    </th>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>`;
    }

    static renderObjectRow(
        myPath: string,
        myCopyPath: string,
        keyHtml: string,
        valHtml: string,
        tooltipHtml: string,
        inlineDescHtml: string
    ): string {
        const escapedCopyPath = this.escape(myCopyPath);
        return `<tr id="${myPath}" class="${DocDockConstants.CssClasses.HoverRow} scroll-mt-20">
            <td class="${DocDockConstants.CssClasses.PropertyKeyCell}">
                <span class="break-all">${keyHtml}</span>
                <button data-copy-path="${escapedCopyPath}" class="${DocDockConstants.CssClasses.CopyCmdBtn}" title="Copy Key">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><use href="#icon-copy"></use></svg>
                </button>
            </td>
            <td class="align-top">
                <div class="flex items-start h-full">
                    <div class="flex-grow w-full min-w-0">${valHtml}</div>
                    ${tooltipHtml}
                </div>
                ${inlineDescHtml}
            </td>
        </tr>`;
    }

    static renderInlineDescription(descHtml: string): string {
        return `<div class="${DocDockConstants.CssClasses.ElemInlineDescWrapper}">
            <div class="overflow-hidden">
                <div class="${DocDockConstants.CssClasses.ElemInlineDesc} text-slate-600 italic text-xs mt-1 border-t border-slate-100 pt-1">${descHtml}</div>
            </div>
        </div>`;
    }

    static renderPrimitiveInlineDescription(descHtml: string): string {
        return `<div class="${DocDockConstants.CssClasses.ElemInlineDescWrapper}">
            <div class="overflow-hidden">
                <div class="${DocDockConstants.CssClasses.ElemInlineDesc} text-slate-600 italic text-xs mt-2 border-t border-slate-200 pt-2">${descHtml}</div>
            </div>
        </div>`;
    }
}
