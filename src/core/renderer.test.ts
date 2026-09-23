import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateRenderer } from './renderer';
import { ModeStrategy } from '../modes/types';
import { RenderContext } from './render-context';

const mockStrategy = {
    isIntrinsic: vi.fn(),
    getSchema: vi.fn(),
    getMergeableKeys: vi.fn(),
    getSectionSortOrder: vi.fn(),
    getIgnoredSections: vi.fn(),
    getAttributes: vi.fn(),
    getCustomizer: vi.fn(),
    getSectionRenderType: vi.fn(),
    getDuplicateExemptKeys: vi.fn(),
    getResourceComponents: vi.fn()
} as unknown as ModeStrategy;

describe('TemplateRenderer', () => {
    let renderer: TemplateRenderer;

    beforeEach(() => {
        vi.resetAllMocks();
        renderer = new TemplateRenderer(mockStrategy);
    });

    describe('renderFlow (primitive)', () => {
        it('should render string', () => {
            const html = renderer.renderFlow('hello', new RenderContext(0, 'root'));
            expect(html).toMatchSnapshot();
        });

        it('should render number', () => {
            const html = renderer.renderFlow(123, new RenderContext(0, 'root'));
            expect(html).toMatchSnapshot();
        });
    });

    describe('renderFlow (array)', () => {
        it('should render array items', () => {
            const html = renderer.renderFlow([1, 2], new RenderContext(0, 'root'));
            expect(html).toMatchSnapshot();
        });
    });

    describe('renderValue (Table)', () => {
        it('should render object as table', () => {
            const val = { key1: 'value1' };
            const html = renderer.renderValue(val, undefined, new RenderContext(0, 'root'));
            expect(html).toMatchSnapshot();
        });

        it('should escape regex values and keys in table', () => {
            const val = { 'pattern?<1>': '(?<group>[a-zA-Z]+)' };
            const html = renderer.renderValue(val, undefined, new RenderContext(0, 'root'));
            expect(html).toContain('pattern?&lt;1&gt;');
            expect(html).toContain('(?&lt;group&gt;[a-zA-Z]+)');
            expect(html).not.toContain('(?<group>[a-zA-Z]+)');
        });
    });

    describe('renderIntrinsic', () => {
        it('should render intrinsic function', () => {
            vi.mocked(mockStrategy.isIntrinsic).mockReturnValue(true);
            const val = { '!Ref': 'MyResource' };

            const html = renderer.renderValue(val, undefined, new RenderContext(0, 'path'));

            expect(html).toMatchSnapshot();
        });
    });

    describe('findMatchingGuide integration via renderValue', () => {
        it('should match guide using prefix keys for primitive arrays', () => {
            const val = ['AWS::LanguageExtensions', 'AWS::Serverless-2016-10-31'];
            const desc = [{ '[AWS::LanguageExtensions]': 'Language Extensions Guide' }];
            const html = renderer.renderValue(val, desc, new RenderContext(0, 'root'));
            expect(html).toContain('Language Extensions Guide');
        });

        it('should render alias in primitive array when metadata contains alias', () => {
            const val = ['AWS::LanguageExtensions'];
            const desc = [
                {
                    '[AWS::LanguageExtensions]': {
                        _alias: 'Language Extensions Alias',
                        Description: 'Language Extensions Guide'
                    }
                }
            ];
            // プリミティブ配列要素に対する別名表示の検証
            const html = renderer.renderValue(val, desc, new RenderContext(0, 'root'));
            expect(html).toContain('Language Extensions Alias');
            expect(html).toContain('Language Extensions Guide');
        });

        it('should match guide using prefix keys for complex arrays', () => {
            const val = [
                { name: 'web', image: 'nginx' },
                { name: 'db', image: 'postgres' }
            ];
            const desc = [
                {
                    '[name=web]': 'web',
                    image: 'Web Container Image Description'
                }
            ];
            const html = renderer.renderValue(val, desc, new RenderContext(0, 'root'));
            expect(html).toContain('Web Container Image Description');
        });
    });

    describe('logical path ID and rawPath generation', () => {
        it('should generate logical rawPath and sanitized id path for complex arrays with prefix matching', () => {
            const val = [{ name: 'web', image: 'nginx' }];
            const desc = [
                {
                    '[name=web]': 'web',
                    image: 'Web Container Image Description'
                }
            ];
            const html = renderer.renderValue(val, desc, new RenderContext(0, 'root', ['root'], 'root'));

            expect(html).toContain('id="root.[name=web].image"');
            expect(html).toContain('data-copy-path="root[name=web].image"');
            expect(html).toContain('class="copy-cmd-btn"');
        });

        it('should generate logical rawPath and sanitized id path for primitive arrays with prefix matching', () => {
            const val = ['AWS::LanguageExtensions'];
            const desc = [{ '[AWS::LanguageExtensions]': 'Language Extensions Guide' }];
            const html = renderer.renderValue(val, desc, new RenderContext(0, 'root', ['root']));

            expect(html).toContain('id="root.[AWS::LanguageExtensions]"');
        });

        it('should resolve child condition keys even if parent guide is undefined using reverse guide lookup', () => {
            const doc = {
                template: {},
                description: {
                    tasks: [
                        {
                            '[taskArn=arn:aws:ecs:us-east-1:123456789012:task/MyCluster/74de0355a10a4f979ac495c14EXAMPLE]':
                                '',
                            containers: [
                                {
                                    '[name=web]': '',
                                    image: 'Container Image Description'
                                }
                            ]
                        }
                    ]
                }
            };
            const rendererWithDoc = new TemplateRenderer(mockStrategy, doc);

            const val = [{ name: 'web', image: 'nginx' }];

            const html = rendererWithDoc.renderValue(
                val,
                undefined,
                new RenderContext(0, 'tasks.[1].containers', ['tasks', '1', 'containers'], 'tasks[].containers')
            );

            expect(html).toContain('id="tasks.[1].containers.[name=web].image"');
            expect(html).toContain('data-copy-path="tasks[].containers[name=web].image"');
            expect(html).toContain('class="copy-cmd-btn"');
        });

        it('should safely escape copyPath containing quotes and symbols in data-copy-path', () => {
            const val = { "user's_key": 'value' };
            const html = renderer.renderValue(
                val,
                undefined,
                new RenderContext(0, 'root', ['root'], "root.user's_key")
            );

            expect(html).toContain('data-copy-path="root.user&#39;s_key.user&#39;s_key"');
            expect(html).toContain('class="copy-cmd-btn"');
        });

        it('should assign unique DOM IDs when multiple items in array match the same condition', () => {
            const val = [
                { name: 'web', port: 80 },
                { name: 'web', port: 8080 }
            ];
            const desc = [{ '[name=web]': 'web', port: 'Port Description' }];
            // 同一条件要素に対するDOM ID重複回避の検証
            const html = renderer.renderValue(
                val,
                desc,
                new RenderContext(0, 'containers', ['containers'], 'containers')
            );

            expect(html).toContain('id="containers.[name=web]"');
            expect(html).toContain('id="containers.[name=web]_1"');
        });

        it('should assign unique DOM IDs for primitive array with duplicate values', () => {
            const val = ['us-east-1', 'us-east-1'];
            const desc = [{ '[us-east-1]': 'Virginia Region' }];
            // スカラー配列の重複値に対するDOM ID重複回避の検証
            const html = renderer.renderValue(val, desc, new RenderContext(0, 'regions', ['regions'], 'regions'));

            expect(html).toContain('id="regions.[us-east-1]"');
            expect(html).toContain('id="regions.[us-east-1]_1"');
        });
    });
});
