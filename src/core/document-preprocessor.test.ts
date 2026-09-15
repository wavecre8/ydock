import { GenericStrategy } from '../modes/generic';
import { CfnStrategy } from '../modes/cfn';
import { describe, it, expect } from 'vitest';
import { DocumentPreprocessor } from './document-preprocessor';
import { ConditionMatcher } from './condition-matcher';
import { DocDockConstants } from './constants';

describe('DocumentPreprocessor', () => {
    it('should prune tree using excludeTree', () => {
        const doc = {
            template: {
                connectivityAt: '2024-01-01',
                containers: [
                    {
                        name: 'web',
                        image: 'nginx',
                        networkInterfaces: [{ attachmentId: '123' }]
                    }
                ],
                otherProp: 'value'
            },
            excludeTree: {
                connectivityAt: true,
                containers: {
                    __value: true,
                    '[]': {
                        name: { __value: false }
                    }
                }
            }
        };
        const matcher = new ConditionMatcher(new GenericStrategy(), doc);
        const result = DocumentPreprocessor.process(doc, matcher);

        expect(result.template.connectivityAt).toBeUndefined();
        expect(result.template.otherProp).toBe('value');
        const containers = result.template.containers as any[];
        expect(containers[0].name).toBe('web');
        expect(containers[0].image).toBeUndefined();
        expect(containers[0].networkInterfaces).toBeUndefined();
    });

    it('should retain all array items when multiple items match the same condition', () => {
        const doc = {
            template: {
                tasks: [
                    { name: 'task1', status: 'active' },
                    { name: 'task2', status: 'active' }
                ]
            },
            description: {
                tasks: [
                    {
                        '[status=active]': '',
                        Description: 'Active task'
                    }
                ]
            }
        };
        const matcher = new ConditionMatcher(new GenericStrategy(), doc);
        const result = DocumentPreprocessor.process(doc, matcher);

        const tasks = result.template.tasks as Record<string, any>;
        expect(Object.keys(tasks).length).toBe(2);
        expect(tasks['[status=active]']).toEqual({ name: 'task1', status: 'active' });
        expect(tasks['[status=active]_1']).toEqual({ name: 'task2', status: 'active' });

        const desc = result.description?.tasks as Record<string, any>;
        expect(desc['[status=active]']).toBeDefined();
        expect(desc['[status=active]_1']).toBeDefined();
    });

    it('should normalize scalar Transform and Description in cfn mode', () => {
        const doc = {
            mode: 'cfn' as const,
            sourcePath: 'sources/template.yml',
            template: {
                Description: 'Test Description Text',
                Transform: 'AWS::LanguageExtensions',
                Resources: {
                    MyBucket: { Type: 'AWS::S3::Bucket' }
                }
            }
        };
        const matcher = new ConditionMatcher(new CfnStrategy(), doc);
        const result = DocumentPreprocessor.process(doc, matcher);

        // Transformがオブジェクト化され要素が保持されることの検証
        const transformObj = result.template.Transform as Record<string, any>;
        expect(transformObj).toBeDefined();
        expect(typeof transformObj).toBe('object');
        expect(transformObj['0']).toBe('AWS::LanguageExtensions');

        // Descriptionがファイル名属性付きオブジェクトへ構造化されることの検証
        const descObj = result.template.Description as Record<string, any>;
        expect(descObj).toBeDefined();
        expect(typeof descObj).toBe('object');
        expect(descObj['0']).toEqual({
            fileName: 'template.yml',
            content: 'Test Description Text'
        });
    });

    it('トップレベル配列セクションの説明文が文字列またはオブジェクトの場合に消失せず保持されること', () => {
        const doc = {
            template: {
                tasks: [{ id: 1, name: 'Build' }]
            },
            description: {
                tasks: 'Tasks Section Description'
            }
        };
        const matcher = new ConditionMatcher(new GenericStrategy(), doc);
        const result = DocumentPreprocessor.process(doc, matcher);

        const descObj = result.description?.tasks as Record<string, any>;
        expect(descObj).toBeDefined();
        expect(descObj[DocDockConstants.ReservedKeys.DescriptionUpper]).toBe('Tasks Section Description');
    });

    it('トップレベル配列セクションの説明文オブジェクト内のDescriptionキーが保持されること', () => {
        const doc = {
            template: {
                tasks: [{ id: 1, name: 'Build' }]
            },
            description: {
                tasks: {
                    Description: 'Tasks Object Description',
                    _alias: 'Task Alias'
                }
            }
        };
        const matcher = new ConditionMatcher(new GenericStrategy(), doc);
        const result = DocumentPreprocessor.process(doc, matcher);

        const descObj = result.description?.tasks as Record<string, any>;
        expect(descObj).toBeDefined();
        expect(descObj[DocDockConstants.ReservedKeys.DescriptionUpper]).toBe('Tasks Object Description');
        expect(descObj[DocDockConstants.ReservedKeys.Alias]).toBe('Task Alias');
    });
});
