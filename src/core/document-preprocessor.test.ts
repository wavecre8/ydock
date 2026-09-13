import { GenericStrategy } from '../modes/generic';
import { describe, it, expect } from 'vitest';
import { DocumentPreprocessor } from './document-preprocessor';
import { ConditionMatcher } from './condition-matcher';

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
                        '=status': 'active',
                        Description: 'Active task'
                    }
                ]
            }
        };
        const matcher = new ConditionMatcher(new GenericStrategy(), doc);
        const result = DocumentPreprocessor.process(doc, matcher);

        const tasks = result.template.tasks as Record<string, any>;
        expect(Object.keys(tasks).length).toBe(2);
        expect(tasks['=status:active']).toEqual({ name: 'task1', status: 'active' });
        expect(tasks['=status:active_1']).toEqual({ name: 'task2', status: 'active' });

        const desc = result.description?.tasks as Record<string, any>;
        expect(desc['=status:active']).toBeDefined();
        expect(desc['=status:active_1']).toBeDefined();
    });
});
