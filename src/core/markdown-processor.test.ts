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

        it('should escape url attributes containing quotes or special characters', () => {
             const input = '[Test Link](https://example.com/search?q="test"&type=1)';
             const result = MarkdownProcessor.render(input);
             expect(result).toContain('href="https://example.com/search?q=&quot;test&quot;&amp;type=1"');
        });

        it('should auto-insert Properties segment for CFn resource property links', () => {
            const inputWithoutProperties = '[ImageId](Resources.MyInstance.ImageId)';
            expect(MarkdownProcessor.render(inputWithoutProperties)).toMatch(/<a\s+href="#Resources__MyInstance__Properties__ImageId".*?>ImageId<\/a>/);

            const inputWithProperties = '[ImageId](Resources.MyInstance.Properties.ImageId)';
            expect(MarkdownProcessor.render(inputWithProperties)).toMatch(/<a\s+href="#Resources__MyInstance__Properties__ImageId".*?>ImageId<\/a>/);

            const inputAttribute = '[Type](Resources.MyInstance.Type)';
            expect(MarkdownProcessor.render(inputAttribute)).toMatch(/<a\s+href="#Resources__MyInstance__Type".*?>Type<\/a>/);
        });

        it('should escape malicious html in link labels', () => {
            const input = '[<script>alert("xss")</script>](https://example.com)';
            const result = MarkdownProcessor.render(input);
            // リンク表示テキストのHTMLエスケープ検証
            expect(result).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
            expect(result).not.toContain('<script>');
        });

        it('should correctly parse links containing nested parentheses in url', () => {
            const input = '[Wiki](https://en.wikipedia.org/wiki/Function_(mathematics))';
            const result = MarkdownProcessor.render(input);
            // ネストされた丸括弧を含むURLのリンク抽出検証
            expect(result).toContain('href="https://en.wikipedia.org/wiki/Function_(mathematics)"');
            expect(result).toContain('>Wiki</a>');
        });

        it('should escape html special characters in non-link plain text', () => {
            const input = 'Port < 1024 & "privileged" requires root';
            const result = MarkdownProcessor.render(input);
            // 平文テキストのHTMLエスケープ検証
            expect(result).toBe('Port &lt; 1024 &amp; &quot;privileged&quot; requires root');
        });
    });
});
