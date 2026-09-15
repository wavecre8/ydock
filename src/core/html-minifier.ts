export class HtmlMinifier {
    private static readonly PROTECTED_TAGS = ['pre', 'textarea', 'script', 'style'];
    private static readonly BLOCK_TAGS = [
        'html',
        'head',
        'body',
        'header',
        'footer',
        'nav',
        'main',
        'section',
        'article',
        'aside',
        'div',
        'table',
        'thead',
        'tbody',
        'tfoot',
        'tr',
        'th',
        'td',
        'colgroup',
        'col',
        'ul',
        'ol',
        'li',
        'dl',
        'dt',
        'dd',
        'form',
        'fieldset',
        'legend',
        'button',
        'svg',
        'path',
        'use'
    ];

    /**
     * 安全にHTMLから不要な空白および改行を除去
     */
    static minify(rawHtml: string): string {
        if (!rawHtml) return '';

        const placeholders: string[] = [];
        const placeholderPrefix = `__PROTECTED_BLOCK_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}_${Date.now()}_`;

        // 整形済みテキスト要素およびスクリプト要素の一時保護
        const tagPattern = new RegExp(
            `<(?:${this.PROTECTED_TAGS.join('|')})\\b[^>]*>[\\s\\S]*?<\\/(?:${this.PROTECTED_TAGS.join('|')})>`,
            'gi'
        );
        let text = rawHtml.replace(tagPattern, (match) => {
            const id = `${placeholderPrefix}${placeholders.length}__`;
            placeholders.push(match);
            return id;
        });

        // 複数行テキスト表示要素の一時保護
        const inlineDescStartPattern = /<div\b[^>]*class="[^"]*elem-inline-desc[^"]*"[^>]*>/gi;
        let match: RegExpExecArray | null;
        let offset = 0;
        let modifiedText = '';

        while ((match = inlineDescStartPattern.exec(text)) !== null) {
            const startIndex = match.index;
            modifiedText += text.substring(offset, startIndex);

            // ネストされたdivタグの深度を走査
            const afterStart = startIndex + match[0].length;
            let depth = 1;
            const tagFinder = /<\/?div\b[^>]*>/gi;
            tagFinder.lastIndex = afterStart;

            let tagMatch: RegExpExecArray | null;
            let matchedEnd = -1;
            while ((tagMatch = tagFinder.exec(text)) !== null) {
                if (tagMatch[0].startsWith('</')) {
                    depth--;
                    if (depth === 0) {
                        matchedEnd = tagMatch.index + tagMatch[0].length;
                        break;
                    }
                } else {
                    depth++;
                }
            }

            if (matchedEnd !== -1) {
                const fullBlock = text.substring(startIndex, matchedEnd);
                const placeholderId = `${placeholderPrefix}${placeholders.length}__`;
                placeholders.push(fullBlock);
                modifiedText += placeholderId;
                offset = matchedEnd;
                inlineDescStartPattern.lastIndex = matchedEnd;
            } else {
                modifiedText += match[0];
                offset = afterStart;
            }
        }
        modifiedText += text.substring(offset);
        text = modifiedText;

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
        while (true) {
            const nextText = text.replace(blockPatternCloseToOpen, '$1$2');
            if (nextText === text) break;
            text = nextText;
        }

        const blockPatternOpenToBlock = new RegExp(`(>)\\s+(<(?:\\/)?(?:${blockTagString})\\b[^>]*>)`, 'gi');
        while (true) {
            const nextText = text.replace(blockPatternOpenToBlock, '$1$2');
            if (nextText === text) break;
            text = nextText;
        }

        // インライン要素間の連続空白の単一スペース正規化
        text = text.replace(/>\s+</g, '> <');

        // 保護要素の復元
        for (let i = 0; i < placeholders.length; i++) {
            text = text.split(`${placeholderPrefix}${i}__`).join(placeholders[i]);
        }

        return text;
    }
}
