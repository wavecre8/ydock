import { describe, it, expect } from 'vitest';
import { GenericStrategy } from './generic';

describe('GenericStrategy', () => {
    const strategy = new GenericStrategy();

    describe('getCustomizer', () => {
        const customizer = strategy.getCustomizer()!;

        it('should concatenate arrays', () => {
            const result = customizer(['a'], ['b'], 'key', undefined, undefined, undefined);
            expect(result).toEqual(['a', 'b']);
        });

        it('should convert scalar + scalar conflict to array', () => {
            const result = customizer('val1', 'val2', 'key', undefined, undefined, undefined);
            expect(result).toEqual(['val1', 'val2']);
        });

        it('should concatenate array + scalar', () => {
            const result = customizer(['a'], 'b', 'key', undefined, undefined, undefined);
            expect(result).toEqual(['a', 'b']);
        });

        it('should concatenate scalar + array', () => {
             const result = customizer('a', ['b'], 'key', undefined, undefined, undefined);
             expect(result).toEqual(['a', 'b']);
        });

        it('should return undefined for non-conflicting types or identical scalars (let lodash handle)', () => {
            const result = customizer('val1', 'val1', 'key', undefined, undefined, undefined);
            // In generic strategy, duplicate scalars are not strictly handled by customizer if equal,
            // but the function actually checks (!_.isObject && !_.isObject && objValue !== srcValue).
            // So equal scalars return undefined.
            expect(result).toBeUndefined();
        });
    });

    describe('isIntrinsic', () => {
        it('should always return false', () => {
            expect(strategy.isIntrinsic({ '!Ref': 'foo' })).toBe(false);
            expect(strategy.isIntrinsic('any')).toBe(false);
        });
    });
});
