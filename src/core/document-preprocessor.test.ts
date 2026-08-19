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
});
