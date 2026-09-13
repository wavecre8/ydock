import { PathParser } from './path-parser';
import { RenderContext } from './render-context';

export class MarkdownProcessor {
    private static readonly LINK_CLASS = 'text-blue-600 hover:text-blue-800 underline';

    private static escapeAttr(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    static render(text: string): string {
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

                        const formattedLink = this.formatLink(escapedLabel, rawUrl);
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
    private static formatLink(escapedLabel: string, rawUrl: string): string | null {
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
            const tokens = PathParser.parse(rawUrl);
            const segments: string[] = [];
            for (const t of tokens) {
                if (t.type === 'prop') {
                    segments.push(t.name);
                } else if (t.type === 'match') {
                    segments.push(t.value === '' ? t.key : `${t.key}:${t.value}`);
                } else if (t.type === 'array') {
                    segments.push('0');
                }
            }
            // CFnリソースのProperties配下への内部参照判定
            let isPropertiesBlock = false;
            const cfnAttributes = [
                'Type',
                'Condition',
                'DependsOn',
                'DeletionPolicy',
                'UpdateReplacePolicy',
                'CreationPolicy',
                'UpdatePolicy',
                'Metadata'
            ];
            if (segments.length >= 3 && segments[0] === 'Resources') {
                if (segments[2] !== 'Properties' && !cfnAttributes.includes(segments[2])) {
                    isPropertiesBlock = true;
                }
            }
            const ctx = RenderContext.create(segments, isPropertiesBlock);
            const id = ctx.path;
            return `<a href="#${id}" class="${this.LINK_CLASS}">${escapedLabel}</a>`;
        } catch {
            return null;
        }
    }
}
