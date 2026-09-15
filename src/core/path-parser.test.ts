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
        expect(PathParser.parse('a[]')).toEqual([{ type: 'prop', name: 'a' }, { type: 'array' }]);
    });

    it('should parse condition matching', () => {
        expect(PathParser.parse('a[key=val]')).toEqual([
            { type: 'prop', name: 'a' },
            { type: 'match', key: 'key', value: 'val' }
        ]);
    });

    it('should handle double colons correctly', () => {
        expect(PathParser.parse('a[AWS::Type=Resource]')).toEqual([
            { type: 'prop', name: 'a' },
            { type: 'match', key: 'AWS::Type', value: 'Resource' }
        ]);
    });

    it('should parse nested brackets in condition correctly', () => {
        expect(PathParser.parse('a[Assert={"FnEquals":["prod","prod"]}]')).toEqual([
            { type: 'prop', name: 'a' },
            { type: 'match', key: 'Assert', value: '{"FnEquals":["prod","prod"]}' }
        ]);
    });

    it('should parse composite conditions joined by ampersand', () => {
        expect(PathParser.parse('a[type=web&env=prod].image')).toEqual([
            { type: 'prop', name: 'a' },
            { type: 'match', key: 'type', value: 'web' },
            { type: 'match', key: 'env', value: 'prod' },
            { type: 'prop', name: 'image' }
        ]);
    });

    it('should parse scalar element selector correctly', () => {
        expect(PathParser.parse('Transform[AWS::Serverless-2016-10-31]')).toEqual([
            { type: 'prop', name: 'Transform' },
            { type: 'match', key: 'AWS::Serverless-2016-10-31', value: '' }
        ]);
    });

    it('should parse conditions containing equal signs within quoted values', () => {
        expect(PathParser.parse('items[filter="status=active"].name')).toEqual([
            { type: 'prop', name: 'items' },
            { type: 'match', key: 'filter', value: '"status=active"' },
            { type: 'prop', name: 'name' }
        ]);
    });
});
