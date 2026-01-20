import { describe, it, expect } from 'vitest';
import { Merger } from './merger';

describe('Merger', () => {
    describe('mergeDescriptions', () => {
        it('should merge multiple objects correctly', () => {
            const source1 = { a: 1 };
            const source2 = { b: 2 };
            const result = Merger.mergeDescriptions([source1, source2]);
            expect(result).toEqual({ a: 1, b: 2 });
        });

        it('should overwrite earlier keys with later keys', () => {
            const source1 = { a: 1 };
            const source2 = { a: 2 };
            const result = Merger.mergeDescriptions([source1, source2]);
            expect(result).toEqual({ a: 2 });
        });

        it('should handle deep merging', () => {
            const source1 = { a: { x: 1 } };
            const source2 = { a: { y: 2 } };
            const result = Merger.mergeDescriptions([source1, source2]);
            expect(result).toEqual({ a: { x: 1, y: 2 } });
        });

        it('should use customizer if provided', () => {
            const source1 = { a: [1] };
            const source2 = { a: [2] };

            const customizer = (objValue: any, srcValue: any) => {
                if (Array.isArray(objValue)) {
                    return objValue.concat(srcValue);
                }
            };

            const result = Merger.mergeDescriptions([source1, source2], customizer);
            expect(result).toEqual({ a: [1, 2] });
        });
    });
});
