import { describe, it, expect } from 'vitest';
import { HtmlMinifier } from './html-minifier';

describe('HtmlMinifier', () => {
    it('should return empty string for empty input', () => {
        expect(HtmlMinifier.minify('')).toBe('');
    });

    it('should remove whitespace between block tags', () => {
        const input = `
            <div>
                <table>
                    <tbody>
                        <tr>
                            <td>Content</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        const result = HtmlMinifier.minify(input);
        expect(result).toBe('<div><table><tbody><tr><td>Content</td></tr></tbody></table></div>');
    });

    it('should preserve necessary single space between inline tags', () => {
        const input = '<span>First</span> \n <span>Second</span>';
        const result = HtmlMinifier.minify(input);
        expect(result).toBe('<span>First</span> <span>Second</span>');
    });

    it('should preserve preformatted blocks exactly', () => {
        const preContent = '<pre>   const a = 1;\n   const b = 2;\n</pre>';
        const input = `<div>\n  ${preContent}\n</div>`;
        const result = HtmlMinifier.minify(input);
        expect(result).toContain(preContent);
    });

    it('should preserve script and style blocks exactly', () => {
        const scriptContent = '<script>\n  // test\n  const x = 10;\n</script>';
        const input = `<html>\n<head>\n${scriptContent}\n</head>\n</html>`;
        const result = HtmlMinifier.minify(input);
        expect(result).toContain(scriptContent);
    });

    it('should preserve nested div elements within inline descriptions', () => {
        const nestedDesc = '<div class="elem-inline-desc">Line 1\n<div>Nested Line 2</div>\nLine 3</div>';
        const input = `<div>\n  ${nestedDesc}\n</div>`;
        const result = HtmlMinifier.minify(input);
        expect(result).toContain(nestedDesc);
    });

    it('本文中にプレースホルダー形式の文字列が含まれていても誤置換されないこと', () => {
        const input = '<div><span>___PROTECTED_BLOCK_0___</span><pre>code block</pre></div>';
        const result = HtmlMinifier.minify(input);
        expect(result).toContain('___PROTECTED_BLOCK_0___');
        expect(result).toContain('<pre>code block</pre>');
    });
});
