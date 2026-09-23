import { describe, it, expect } from 'vitest';
import { MarkdownProcessor } from './markdown-processor';
import { CfnStrategy } from '../modes/cfn';

describe('MarkdownProcessor', () => {
    describe('render', () => {
        it('should return input if not string', () => {
            expect(MarkdownProcessor.render(null as any)).toBe(null);
            expect(MarkdownProcessor.render(123 as any)).toBe(123);
        });

        it('should render external links', () => {
            const input = '[Google](https://google.com)';
            expect(MarkdownProcessor.render(input)).toMatch(
                /<a\s+href="https:\/\/google\.com"\s+target="_blank".*?>Google<\/a>/
            );
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
            expect(MarkdownProcessor.render(input)).toMatch(/<a\s+href="#Parent.Child".*?>Deep<\/a>/);
        });

        it('should sanitize deep internal links individually using JSONPath style', () => {
            const input = '[Deep Invalid](Parent Key.Child Key)';
            expect(MarkdownProcessor.render(input)).toMatch(/<a\s+href="#Parent_Key.Child_Key".*?>Deep Invalid<\/a>/);
        });

        it('should render and sanitize JSONPath style links with conditions', () => {
            const input =
                '[ECS RuntimeID](tasks[taskArn=arn:aws:ecs:us-east-1:123456789012:task/MyCluster/74de0355a10a4f979ac495c14EXAMPLE].containers[name=web].runtimeId)';
            expect(MarkdownProcessor.render(input)).toMatch(
                /<a\s+href="#tasks\.\[taskArn=arn:aws:ecs:us-east-1:123456789012:task_MyCluster_74de0355a10a4f979ac495c14EXAMPLE\]\.containers\.\[name=web\]\.runtimeId".*?>ECS RuntimeID<\/a>/
            );
        });

        it('should fallback generic array index to 0 in JSONPath style links', () => {
            const input = '[First Container](tasks[].containers[].name)';
            expect(MarkdownProcessor.render(input)).toMatch(
                /<a\s+href="#tasks\.\[\]\.containers\.\[\]\.name".*?>First Container<\/a>/
            );
        });

        it('should escape url attributes containing quotes or special characters', () => {
            const input = '[Test Link](https://example.com/search?q="test"&type=1)';
            const result = MarkdownProcessor.render(input);
            expect(result).toContain('href="https://example.com/search?q=&quot;test&quot;&amp;type=1"');
        });

        it('should auto-insert Properties segment for CFn resource property links when Cfn mode is used', () => {
            const cfnStrategy = new CfnStrategy();
            const inputWithoutProperties = '[ImageId](Resources.MyInstance.ImageId)';
            expect(MarkdownProcessor.render(inputWithoutProperties, undefined, cfnStrategy)).toMatch(
                /<a\s+href="#Resources.MyInstance.Properties.ImageId".*?>ImageId<\/a>/
            );

            const inputWithProperties = '[ImageId](Resources.MyInstance.Properties.ImageId)';
            expect(MarkdownProcessor.render(inputWithProperties, undefined, cfnStrategy)).toMatch(
                /<a\s+href="#Resources.MyInstance.Properties.ImageId".*?>ImageId<\/a>/
            );

            const inputAttribute = '[Type](Resources.MyInstance.Type)';
            expect(MarkdownProcessor.render(inputAttribute, undefined, cfnStrategy)).toMatch(
                /<a\s+href="#Resources.MyInstance.Type".*?>Type<\/a>/
            );
        });

        it('should keep original segments by default in generic mode without auto-inserting Properties', () => {
            const input = '[ImageId](Resources.MyInstance.ImageId)';
            expect(MarkdownProcessor.render(input)).toMatch(
                /<a\s+href="#Resources.MyInstance.ImageId".*?>ImageId<\/a>/
            );
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

        it('should apply static docPrefix when string is provided', () => {
            const input = '[Task](tasks[id=1].name)';
            const result = MarkdownProcessor.render(input, 'doc_0');
            // 静的プレフィックス適用アンカーリンクの生成検証
            expect(result).toContain('href="#doc_0.tasks.[id=1].name"');
        });

        it('should resolve docPrefix dynamically using resolver function', () => {
            const inputSelf = '[Self Task](tasks[id=1].name)';
            const inputOther = '[Other EC2](Reservations[id=2].name)';
            const resolver = (target: string | string[]) => {
                const key = Array.isArray(target) ? target[0] : target;
                if (key === 'tasks') return 'doc_0';
                if (key === 'Reservations') return 'doc_1';
                return undefined;
            };
            const resultSelf = MarkdownProcessor.render(inputSelf, resolver);
            const resultOther = MarkdownProcessor.render(inputOther, resolver);
            // 自ドキュメントキーおよび他ドキュメントキーの動的接頭辞解決検証
            expect(resultSelf).toContain('href="#doc_0.tasks.[id=1].name"');
            expect(resultOther).toContain('href="#doc_1.Reservations.[id=2].name"');
        });

        it('should extract explicit document scope and pass it to resolver function', () => {
            const input = '[Scoped Task](ecs_secondary::Tasks.worker)';
            let receivedExplicitDoc: string | undefined;
            const resolver = (_target: string | string[], explicitDoc?: string) => {
                receivedExplicitDoc = explicitDoc;
                if (explicitDoc === 'ecs_secondary') return 'doc_2';
                return 'doc_0';
            };
            // 明示的スコープ指定を含むマークダウン描画の実行
            const result = MarkdownProcessor.render(input, resolver);
            expect(receivedExplicitDoc).toBe('ecs_secondary');
            expect(result).toContain('href="#doc_2.Tasks.worker"');
        });

        it('should generate cross-page link when explicitDoc targets another page', () => {
            const input = '[Cross Page](cfn_part::EC2Instance.MapVal)';
            const result = MarkdownProcessor.render(input, undefined, new CfnStrategy());
            expect(result).toContain('href="cfn_part.html#Resources.EC2Instance.Properties.MapVal"');
        });
    });
});
