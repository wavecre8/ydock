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

    describe('renderAliasedKey', () => {
        it('should return plain key if no alias provided', () => {
            expect(HtmlComponents.renderAliasedKey('MyKey', undefined)).toBe('MyKey');
        });

        it('should return structured html if alias provided', () => {
            const result = HtmlComponents.renderAliasedKey('MyKey', 'MyAlias');
            
            expect(result).toContain('MyKey');
            expect(result).toContain('MyAlias');
            expect(result).toContain('alias-wrapper');
        });
    });
});
