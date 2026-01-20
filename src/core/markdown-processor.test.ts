import { describe, it, expect } from 'vitest';
import { MarkdownProcessor } from './markdown-processor';

describe('MarkdownProcessor', () => {
    describe('render', () => {
        it('should return input if not string', () => {
            expect(MarkdownProcessor.render(null as any)).toBe(null);
            expect(MarkdownProcessor.render(123 as any)).toBe(123);
        });

        it('should render external links', () => {
            const input = '[Google](https://google.com)';
            expect(MarkdownProcessor.render(input)).toMatch(/<a\s+href="https:\/\/google\.com"\s+target="_blank".*?>Google<\/a>/);
        });

        it('should render relative paths', () => {
             const input = '[Relative](./path/to/file)';
             expect(MarkdownProcessor.render(input)).toMatch(/<a\s+href="\.\/path\/to\/file".*?>Relative<\/a>/);
        });

        it('should render protocol links (mailto)', () => {
            const input = '[Email](mailto:test@example.com)';
            expect(MarkdownProcessor.render(input)).toMatch(/<a\s+href="mailto:test@example\.com".*?>Email<\/a>/);
        });

        it('should render anchor links', () => {
             const input = '[Section](#section-id)';
             expect(MarkdownProcessor.render(input)).toMatch(/<a\s+href="#section-id".*?>Section<\/a>/);
        });

        it('should render internal navigation links (simple)', () => {
            const input = '[MyComponent](MyComponent)';
            expect(MarkdownProcessor.render(input)).toMatch(/<a\s+href="#MyComponent".*?>MyComponent<\/a>/);
        });

        it('should render internal navigation links (sanitized)', () => {
            const input = '[Invalid Key](Invalid Key)';
            expect(MarkdownProcessor.render(input)).toMatch(/<a\s+href="#Invalid_Key".*?>Invalid Key<\/a>/);
        });

        it('should render deep internal links with double underscore', () => {
            const input = '[Deep](Parent__Child)';
            expect(MarkdownProcessor.render(input)).toMatch(/<a\s+href="#Parent__Child".*?>Deep<\/a>/);
        });

        it('should sanitize deep internal links individually', () => {
             const input = '[Deep Invalid](Parent Key__Child Key)';
             expect(MarkdownProcessor.render(input)).toMatch(/<a\s+href="#Parent_Key__Child_Key".*?>Deep Invalid<\/a>/);
        });
    });
});
