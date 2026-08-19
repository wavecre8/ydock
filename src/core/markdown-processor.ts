import { PathParser } from './path-parser';
import { RenderContext } from './render-context';

export class MarkdownProcessor {
    private static readonly LINK_CLASS = 'text-blue-600 hover:text-blue-800 underline';

    static render(text: string): string {
        if (typeof text !== 'string') return text;

        // External links (http/https)
        text = text.replace(
            /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
            (match, label, url) =>
                `<a href="${url}" target="_blank" rel="noopener noreferrer" class="${this.LINK_CLASS}">${label}</a>`
        );

        // Protocol links (ftp, mailto, file) or Relative paths
        text = text.replace(
            /\[([^\]]+)\]\(((?:ftp|mailto|file):[^)]+|(?:\.?\.?\/)[^)]+)\)/g,
            (match, label, url) => `<a href="${url}" class="${this.LINK_CLASS}">${label}</a>`
        );

        // Anchor links (#...)
        text = text.replace(
            /\[([^\]]+)\]\((#[^)]+)\)/g,
            (match, label, anchor) => `<a href="${anchor}" class="${this.LINK_CLASS}">${label}</a>`
        );

        // Internal navigation links (JSONPath-like property paths only)
        text = text.replace(/\[([^\]]+)\]\((?!https?:|ftp:|mailto:|file:|\/|\.|#)([^)]+)\)/g, (match, label, link) => {
            try {
                const tokens = PathParser.parse(link);
                const segments: string[] = [];
                for (const t of tokens) {
                    if (t.type === 'prop') {
                        segments.push(t.name);
                    } else if (t.type === 'match') {
                        // Restore condition string like "=key:value" or "=key"
                        segments.push(t.value === '' ? t.key : `${t.key}:${t.value}`);
                    } else if (t.type === 'array') {
                        // Fallback to index 0 for generic array specification "[]"
                        segments.push('0');
                    }
                }
                const ctx = RenderContext.create(segments);
                const id = ctx.path;
                return `<a href="#${id}" class="${this.LINK_CLASS}">${label}</a>`;
            } catch {
                // If parsing fails due to invalid syntax, return as-is
                return match;
            }
        });
        return text;
    }
}
