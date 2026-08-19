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

        it('should render deep internal links using JSONPath style', () => {
            const input = '[Deep](Parent.Child)';
            expect(MarkdownProcessor.render(input)).toMatch(/<a\s+href="#Parent__Child".*?>Deep<\/a>/);
        });

        it('should sanitize deep internal links individually using JSONPath style', () => {
             const input = '[Deep Invalid](Parent Key.Child Key)';
             expect(MarkdownProcessor.render(input)).toMatch(/<a\s+href="#Parent_Key__Child_Key".*?>Deep Invalid<\/a>/);
        });

        it('should render and sanitize JSONPath style links with conditions', () => {
             const input = '[ECS RuntimeID](tasks[=taskArn:arn:aws:ecs:us-east-1:123456789012:task/MyCluster/74de0355a10a4f979ac495c14EXAMPLE].containers[=name:web].runtimeId)';
             expect(MarkdownProcessor.render(input)).toMatch(/<a\s+href="#tasks___taskArn_arn_aws_ecs_us-east-1_123456789012_task_MyCluster_74de0355a10a4f979ac495c14EXAMPLE__containers___name_web__runtimeId".*?>ECS RuntimeID<\/a>/);
        });

        it('should fallback generic array index to 0 in JSONPath style links', () => {
             const input = '[First Container](tasks[].containers[].name)';
             expect(MarkdownProcessor.render(input)).toMatch(/<a\s+href="#tasks__0__containers__0__name".*?>First Container<\/a>/);
        });
    });
});
