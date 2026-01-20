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

        // Internal navigation links (custom logic for underscores)
        text = text.replace(/\[([^\]]+)\]\((?!https?:|ftp:|mailto:|file:|\/|\.|#)([^)]+)\)/g, (match, label, link) => {
            if (!link.includes('__')) {
                const id = link.replace(/[^a-zA-Z0-9_-]/g, '_');
                return `<a href="#${id}" class="${this.LINK_CLASS}">${label}</a>`;
            }
            const parts = link.split('__');
            const sanitizedParts = parts.map((p: string) => p.replace(/[^a-zA-Z0-9_-]/g, '_'));
            const id = sanitizedParts.join('__');
            return `<a href="#${id}" class="${this.LINK_CLASS}">${label}</a>`;
        });
        return text;
    }
}
