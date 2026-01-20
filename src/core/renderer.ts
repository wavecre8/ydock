import { ModeStrategy } from '../modes/types';
import { MarkdownProcessor } from './markdown-processor';
import { HtmlComponents } from './html-components';
import { YamlValue, GuideMeta } from '../types';

export class TemplateRenderer {
    private strategy: ModeStrategy;

    constructor(strategy: ModeStrategy) {
        this.strategy = strategy;
    }

    extractMetadata(desc: YamlValue): GuideMeta {
        if (this.isGuideMetaPotential(desc)) {
            const d = desc as Record<string, YamlValue>;

            const description =
                typeof d.Description === 'string'
                    ? d.Description
                    : typeof d.description === 'string'
                      ? d.description
                      : undefined;
            const alias = typeof d._alias === 'string' ? d._alias : undefined;
            const hidden = d._hidden === true || d.__hidden === true;

            return {
                description,
                alias,
                hidden
            };
        }
        if (typeof desc === 'string') {
            return { description: desc, alias: undefined, hidden: false };
        }
        return { description: undefined, alias: undefined, hidden: false };
    }

    private isGuideMetaPotential(val: YamlValue): val is Record<string, YamlValue> {
        return typeof val === 'object' && val !== null;
    }

    isPrimitive(val: unknown): val is string | number | boolean | null | undefined {
        return val === null || typeof val !== 'object';
    }

    isIntrinsic(val: unknown): boolean {
        return this.strategy.isIntrinsic(val);
    }

    renderMarkdownClient(text: string): string {
        return MarkdownProcessor.render(text);
    }

    renderTooltip(descText: string | undefined): string {
        return HtmlComponents.renderTooltip(descText);
    }

    renderAliasedKey(key: string | number, alias: string | undefined): string {
        return HtmlComponents.renderAliasedKey(key, alias);
    }

    renderFlow(val: YamlValue, level: number = 0): string {
        if (val === undefined || val === null) return '';

        if (this.isPrimitive(val)) {
            return `<span class="property-value font-mono text-slate-700">${val}</span>`;
        }

        if (this.isIntrinsic(val)) {
            // Intrinsic functions are objects with one key
            const obj = val as Record<string, YamlValue>;
            const key = Object.keys(obj)[0];
            const innerVal = obj[key];
            return `<div class="inline-flex items-start gap-1 align-top">
                <span class="badge-fn text-[10px] sm:text-xs">${key}</span>
                <span>${this.renderFlow(innerVal, level)}</span>
            </div>`;
        }

        if (Array.isArray(val)) {
            const itemsHtml = val
                .map((item) => this.renderFlow(item, level + 1))
                .join('<span class="text-slate-400 mx-1">,</span>');
            return `<span class="font-mono text-slate-600 inline-flex flex-wrap items-center gap-y-1">
                <span class="text-slate-400 mr-1">[</span>${itemsHtml}<span class="text-slate-400 ml-1">]</span>
            </span>`;
        }

        if (typeof val === 'object') {
            const pairsHtml = Object.entries(val)
                .map(([k, v]) => {
                    return `<span><span class="text-slate-500">${k}:</span> ${this.renderFlow(v, level + 1)}</span>`;
                })
                .join('<span class="text-slate-400 mx-1">,</span>');

            return `<span class="font-mono text-slate-600 inline-flex flex-wrap items-center gap-y-1">
                <span class="text-slate-400 mr-1">{</span>${pairsHtml}<span class="text-slate-400 ml-1">}</span>
            </span>`;
        }

        return JSON.stringify(val);
    }

    renderValue(
        val: YamlValue,
        desc: YamlValue,
        path: string | undefined,
        level: number = 0,
        rawPath: string = ''
    ): string {
        if (val === undefined || val === null) return '';

        if (this.isPrimitive(val)) {
            return this.renderPrimitive(val);
        }

        if (this.isIntrinsic(val)) {
            return this.renderIntrinsic(val as Record<string, YamlValue>, path, level, rawPath);
        }

        if (Array.isArray(val)) {
            return this.renderArray(val, desc, path, level, rawPath);
        }

        if (typeof val === 'object') {
            return this.renderObjectAsTable(val as Record<string, YamlValue>, desc, path, level, rawPath);
        }

        return JSON.stringify(val);
    }

    private renderPrimitive(val: unknown): string {
        return `<span class="property-value">${val}</span>`;
    }

    private renderIntrinsic(
        val: Record<string, YamlValue>,
        path: string | undefined,
        level: number,
        rawPath: string
    ): string {
        const key = Object.keys(val)[0];
        const innerVal = val[key];

        if (Array.isArray(innerVal) || (typeof innerVal === 'object' && innerVal !== null)) {
            return `<div class="flex items-start gap-2 flex-wrap">
                  <span class="badge-fn flex-shrink-0">${key}</span> 
                  ${this.renderFlow(innerVal, level)}
              </div>`;
        }

        const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
        const newRawPath = rawPath ? rawPath + '__' + key : key;
        return `<div class="flex items-start gap-2"><span class="badge-fn">${key}</span> <span>${this.renderValue(innerVal, null, path ? path + '__' + sanitizedKey : undefined, level, newRawPath)}</span></div>`;
    }

    private renderArray(
        val: YamlValue[],
        desc: YamlValue,
        path: string | undefined,
        level: number,
        rawPath: string
    ): string {
        if (val.length === 0) return '';

        const allPrimitives = val.every((item) => this.isPrimitive(item));

        if (allPrimitives) {
            return this.renderPrimitiveArray(val, desc, path);
        } else {
            return this.renderComplexArray(val, desc, path, level, rawPath);
        }
    }

    private renderPrimitiveArray(val: YamlValue[], desc: YamlValue, path: string | undefined): string {
        return `<table class="table-base nested-table text-sm bg-white">
                <thead>
                    <tr>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${val
                        .map((item, i) => {
                            const itemDesc = Array.isArray(desc) ? desc[i] : undefined;
                            const descText = typeof itemDesc === 'string' ? itemDesc : '';
                            const myPath = path ? `${path}__${i}` : undefined;
                            return `<tr id="${myPath}" class="hover-row scroll-mt-20">
                            <td class="align-top">
                                <div class="flex items-start">
                                    <div class="flex-grow"><span class="property-value">${item}</span></div>
                                    ${this.renderTooltip(descText)}
                                </div>
                                ${
                                    descText
                                        ? `
                                <div class="elem-inline-desc-wrapper">
                                    <div class="overflow-hidden">
                                        <div class="elem-inline-desc text-slate-600 italic text-xs mt-2 border-t border-slate-200 pt-2">${this.renderMarkdownClient(descText)}</div>
                                    </div>
                                </div>`
                                        : ''
                                }
                            </td>
                        </tr>`;
                        })
                        .join('')}
                </tbody>
            </table>`;
    }

    private renderComplexArray(
        val: YamlValue[],
        desc: YamlValue,
        path: string | undefined,
        level: number,
        rawPath: string
    ): string {
        return `<div class="flex flex-col gap-4 mt-2">
                ${val
                    .map((item, i) => {
                        let itemDesc: YamlValue = undefined;
                        if (Array.isArray(desc)) {
                            itemDesc = desc[i];
                        } else if (typeof desc === 'object' && desc !== null) {
                            itemDesc = (desc as Record<string, YamlValue>)[i];
                        }
                        const myPath = path ? `${path}__${i}` : undefined;
                        const myRawPath = rawPath ? `${rawPath}__${i}` : undefined;
                        return `<div id="${myPath}" class="border border-slate-200 rounded-md overflow-hidden scroll-mt-20">
                        <div class="bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500 border-b border-slate-200">
                            # ${i}
                        </div>
                        <div class="p-2 bg-white">
                            ${this.renderValue(item, itemDesc, myPath, level, myRawPath)}
                        </div>
                    </div>`;
                    })
                    .join('')}
            </div>`;
    }

    private renderObjectAsTable(
        val: Record<string, YamlValue>,
        desc: YamlValue,
        path: string | undefined,
        level: number,
        rawPath: string
    ): string {
        const keys = Object.keys(val);
        if (keys.length === 0) return '{}';

        const widthVar = `var(--col-width-level-${level}, var(--col-width-level-default))`;

        return `<table class="table-base nested-table text-sm bg-white">
            <colgroup>
                <col style="width: ${widthVar};">
                <col>
            </colgroup>
            <thead>
                <tr>
                    <th class="relative">
                        Property
                        <div class="col-resizer" data-level="${level}"></div>
                    </th>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>
                ${keys
                    .map((key) => {
                        const subVal = val[key];
                        const subDesc =
                            typeof desc === 'object' && desc !== null && !Array.isArray(desc)
                                ? (desc as Record<string, YamlValue>)[key]
                                : undefined;
                        const meta = this.extractMetadata(subDesc);

                        if (meta.hidden) return '';

                        const descText = meta.description;
                        const alias = meta.alias;
                        const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
                        const myPath = path ? `${path}__${sanitizedKey}` : sanitizedKey;
                        const myRawPath = rawPath ? `${rawPath}__${key}` : key;

                        return `<tr id="${myPath}" class="hover-row scroll-mt-20">
                        <td class="property-key-cell font-mono text-slate-600 relative pr-8 align-top">
                            <span class="break-all">${this.renderAliasedKey(key, alias)}</span>
                            <button onclick="copyToClipboard('${myRawPath}', this, event)" class="copy-cmd-btn absolute top-3 right-2 p-1 text-slate-400 hover:text-blue-600 rounded" title="Copy Key">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            </button>
                        </td>
                        <td class="align-top">
                            <div class="flex items-start h-full">
                                <div class="flex-grow w-full min-w-0">${this.renderValue(subVal, subDesc, myPath, level + 1, myRawPath)}</div>
                                ${this.renderTooltip(descText)}
                            </div>
                            ${
                                descText
                                    ? `
                            <div class="elem-inline-desc-wrapper">
                                <div class="overflow-hidden">
                                    <div class="elem-inline-desc text-slate-600 italic text-xs mt-1 border-t border-slate-100 pt-1">${this.renderMarkdownClient(descText)}</div>
                                </div>
                            </div>`
                                    : ''
                            }
                        </td>
                    </tr>`;
                    })
                    .join('')}
            </tbody>
        </table>`;
    }
}
