import { describe, it, expect, vi } from 'vitest';
import { HtmlComponents } from './html-components';
import { MarkdownProcessor } from './markdown-processor';

vi.mock('./markdown-processor');

describe('HtmlComponents', () => {
    describe('renderTooltip', () => {
        it('should return empty string if descText is missing', () => {
            expect(HtmlComponents.renderTooltip(undefined)).toBe('');
            expect(HtmlComponents.renderTooltip('')).toBe('');
        });

        it('should render tooltip html with converted markdown', () => {
            vi.mocked(MarkdownProcessor.render).mockReturnValue('<p>Processed</p>');

            const result = HtmlComponents.renderTooltip('Raw Text');

            expect(MarkdownProcessor.render).toHaveBeenCalledWith('Raw Text');
            expect(result).toContain('tooltip-container');
            expect(result).toContain('<p>Processed</p>');
            expect(result).toContain('tooltip-arrow');
        });
    });

    describe('escape', () => {
        it('should escape html special characters correctly', () => {
            expect(HtmlComponents.escape('?<name>')).toBe('?&lt;name&gt;');
            expect(HtmlComponents.escape('(?<group>[a-zA-Z]+)')).toBe('(?&lt;group&gt;[a-zA-Z]+)');
            expect(HtmlComponents.escape('a & b "c" \'d\'')).toBe('a &amp; b &quot;c&quot; &#39;d&#39;');
            expect(HtmlComponents.escape(null)).toBe('');
            expect(HtmlComponents.escape(undefined)).toBe('');
            expect(HtmlComponents.escape(123)).toBe('123');
        });
    });

    describe('renderAliasedKey', () => {
        it('should return plain key if no alias provided', () => {
            expect(HtmlComponents.renderAliasedKey('MyKey', undefined)).toBe('MyKey');
        });

        it('should escape key when no alias provided', () => {
            expect(HtmlComponents.renderAliasedKey('<MyKey>', undefined)).toBe('&lt;MyKey&gt;');
        });

        it('should return structured html if alias provided', () => {
            const result = HtmlComponents.renderAliasedKey('MyKey', 'MyAlias');
            
            expect(result).toContain('MyKey');
            expect(result).toContain('MyAlias');
            expect(result).toContain('alias-wrapper');
        });

        it('should escape both key and alias', () => {
            const result = HtmlComponents.renderAliasedKey('<MyKey>', '<MyAlias>');
            
            expect(result).toContain('&lt;MyKey&gt;');
            expect(result).toContain('&lt;MyAlias&gt;');
        });
    });

    describe('renderPrimitive', () => {
        it('should escape primitive value including regex pattern', () => {
            const result = HtmlComponents.renderPrimitive('(?<group>[a-zA-Z]+)');
            expect(result).toContain('(?&lt;group&gt;[a-zA-Z]+)');
        });
    });
});
