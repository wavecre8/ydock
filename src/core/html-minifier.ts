export class HtmlMinifier {
    private static readonly PROTECTED_TAGS = ['pre', 'textarea', 'script', 'style'];
    private static readonly BLOCK_TAGS = [
        'html', 'head', 'body', 'header', 'footer', 'nav', 'main', 'section', 'article', 'aside',
        'div', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col',
        'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'form', 'fieldset', 'legend', 'button', 'svg', 'path', 'use'
    ];

    /**
     * 安全にHTMLから不要な空白および改行を除去
     */
    static minify(rawHtml: string): string {
        if (!rawHtml) return '';

        const placeholders: string[] = [];

        // 整形済みテキスト要素およびスクリプト要素の一時保護
        const tagPattern = new RegExp(`<(?:${this.PROTECTED_TAGS.join('|')})\\b[^>]*>[\\s\\S]*?<\\/(?:${this.PROTECTED_TAGS.join('|')})>`, 'gi');
        let text = rawHtml.replace(tagPattern, (match) => {
            const id = `___PROTECTED_BLOCK_${placeholders.length}___`;
            placeholders.push(match);
            return id;
        });

        // 複数行テキスト表示要素の一時保護
        const inlineDescPattern = /<div\b[^>]*class="[^"]*elem-inline-desc[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
        text = text.replace(inlineDescPattern, (match) => {
            const id = `___PROTECTED_BLOCK_${placeholders.length}___`;
            placeholders.push(match);
            return id;
        });

        // 行頭行末の空白除去および空行の排除
        const lines = text.split('\n');
        const trimmedLines: string[] = [];
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (trimmed.length > 0) {
                trimmedLines.push(trimmed);
            }
        }
        text = trimmedLines.join('\n');

        // ブロック要素およびテーブル要素間の空白除去
        const blockTagString = this.BLOCK_TAGS.join('|');
        const blockPatternCloseToOpen = new RegExp(`(<(?:\\/)?(?:${blockTagString})\\b[^>]*>)\\s+(<)`, 'gi');
        while (blockPatternCloseToOpen.test(text)) {
            text = text.replace(blockPatternCloseToOpen, '$1$2');
        }

        const blockPatternOpenToBlock = new RegExp(`(>)\\s+(<(?:\\/)?(?:${blockTagString})\\b[^>]*>)`, 'gi');
        while (blockPatternOpenToBlock.test(text)) {
            text = text.replace(blockPatternOpenToBlock, '$1$2');
        }

        // インライン要素間の連続空白の単一スペース正規化
        text = text.replace(/>\s+</g, '> <');

        // 保護要素の復元
        for (let i = 0; i < placeholders.length; i++) {
            text = text.replace(`___PROTECTED_BLOCK_${i}___`, () => placeholders[i]);
        }

        return text;
    }
}
