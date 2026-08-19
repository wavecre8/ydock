import { MarkdownProcessor } from './markdown-processor';
import { DocDockConstants } from './constants';

export class HtmlComponents {
    static renderTooltip(descText: string | undefined): string {
        if (!descText) return '';
        return `
        <span class="elem-tooltip tooltip-container flex-shrink-0 pt-1">
            <div class="tooltip-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 text-blue-500">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd" />
                </svg>
            </div>
            <div class="tooltip-content">${MarkdownProcessor.render(descText)}<div class="tooltip-arrow"></div></div>
        </span>`;
    }

    static renderAliasedKey(key: string | number, alias: string | undefined): string {
        if (!alias) return String(key);
        return `<span class="text-slate-700 block">${key}</span><span class="alias-wrapper grid transition-[grid-template-rows,opacity] duration-500 ease-in-out"><span class="alias-text text-xs text-slate-400 overflow-hidden min-h-0 block">${alias}</span></span>`;
    }

    static renderPrimitive(val: unknown): string {
        return `<span class="${DocDockConstants.CssClasses.PropertyValue}">${val}</span>`;
    }

    static renderFlowPrimitive(val: unknown): string {
        return `<span class="${DocDockConstants.CssClasses.PropertyValue} font-mono text-slate-700">${val}</span>`;
    }

    static renderFlowIntrinsic(key: string, innerHtml: string): string {
        return `<div class="inline-flex items-start gap-1 align-top">
            <span class="${DocDockConstants.CssClasses.BadgeFn} text-[10px] sm:text-xs">${key}</span>
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
            <span class="${DocDockConstants.CssClasses.BadgeFn} flex-shrink-0">${key}</span> 
            ${innerHtml}
        </div>`;
    }

    static renderIntrinsicBlock(key: string, innerHtml: string): string {
        return `<div class="flex items-start gap-2"><span class="${DocDockConstants.CssClasses.BadgeFn}">${key}</span> <span>${innerHtml}</span></div>`;
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
        inlineDescHtml: string
    ): string {
        return `<tr id="${myPath}" class="${DocDockConstants.CssClasses.HoverRow} scroll-mt-20">
            <td class="align-top">
                <div class="flex items-start">
                    <div class="flex-grow"><span class="${DocDockConstants.CssClasses.PropertyValue}">${itemVal}</span></div>
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

    static renderComplexArrayItem(myPath: string, indexStr: string, innerHtml: string): string {
        return `<div id="${myPath}" class="border border-slate-200 rounded-md overflow-hidden scroll-mt-20">
            <div class="bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500 border-b border-slate-200">
                # ${indexStr}
            </div>
            <div class="p-2 bg-white">
                ${innerHtml}
            </div>
        </div>`;
    }

    static renderObjectTable(
        level: number,
        rowsHtml: string
    ): string {
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
        return `<tr id="${myPath}" class="${DocDockConstants.CssClasses.HoverRow} scroll-mt-20">
            <td class="${DocDockConstants.CssClasses.PropertyKeyCell} font-mono text-slate-600 relative pr-8 align-top">
                <span class="break-all">${keyHtml}</span>
                <button onclick="YdockUI.Clipboard.copyToClipboard('${myCopyPath}', this, event)" class="${DocDockConstants.CssClasses.CopyCmdBtn} absolute right-2 p-1 text-slate-400 hover:text-blue-600 rounded" title="Copy Key">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
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
