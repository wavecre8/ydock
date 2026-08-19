import { describe, it, expect } from 'vitest';
import { PathParser } from './path-parser';

describe('PathParser', () => {
    it('should parse simple properties', () => {
        expect(PathParser.parse('a.b.c')).toEqual([
            { type: 'prop', name: 'a' },
            { type: 'prop', name: 'b' },
            { type: 'prop', name: 'c' }
        ]);
    });

    it('should handle escaped dots', () => {
        expect(PathParser.parse('a\\.b.c')).toEqual([
            { type: 'prop', name: 'a.b' },
            { type: 'prop', name: 'c' }
        ]);
    });

    it('should parse empty brackets as array', () => {
        expect(PathParser.parse('a[]')).toEqual([
            { type: 'prop', name: 'a' },
            { type: 'array' }
        ]);
    });

    it('should parse condition matching', () => {
        expect(PathParser.parse('a[=key:val]')).toEqual([
            { type: 'prop', name: 'a' },
            { type: 'match', key: '=key', value: 'val' }
        ]);
    });

    it('should handle double colons correctly', () => {
        expect(PathParser.parse('a[=AWS::Type:Resource]')).toEqual([
            { type: 'prop', name: 'a' },
            { type: 'match', key: '=AWS::Type', value: 'Resource' }
        ]);
    });
});
