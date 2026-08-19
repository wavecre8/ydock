import { describe, it, expect } from 'vitest';
import { PathResolver } from './path-resolver';

import { CfnStrategy } from '../modes/cfn';

describe('PathResolver', () => {
    describe('resolveArraySegment', () => {
        it('should resolve by index', () => {
            const current = ['a', 'b', 'c'];
            expect(PathResolver.resolveArraySegment(current, '1')).toBe('b');
        });

        it('should resolve by condition key', () => {
            const current = [
                { name: 'web' },
                { name: 'db' }
            ];
            expect(PathResolver.resolveArraySegment(current, '=name:db')).toEqual({ name: 'db' });
        });

        it('should fallback to first element if not found', () => {
            const current = ['a', 'b'];
            expect(PathResolver.resolveArraySegment(current, '5')).toBe('a');
        });
    });

    describe('resolveObjectSegment', () => {
        it('should resolve direct key', () => {
            const obj = { key1: 'val1', key2: 'val2' };
            expect(PathResolver.resolveObjectSegment(obj, 'key2')).toBe('val2');
        });

        it('should resolve inside Properties block if present and CfnStrategy is used', () => {
            const obj = { Properties: { inner: 'val' } };
            const strategy = new CfnStrategy();
            expect(PathResolver.resolveObjectSegment(obj, 'inner', strategy)).toBe('val');
        });

        it('should return first value as fallback for index or condition segment', () => {
            const obj = { key1: 'val1', key2: 'val2' };
            expect(PathResolver.resolveObjectSegment(obj, '0')).toBe('val1');
            expect(PathResolver.resolveObjectSegment(obj, '=name:web')).toBe('val1');
        });
    });
});
