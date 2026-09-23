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
            const current = [{ name: 'web' }, { name: 'db' }];
            expect(PathResolver.resolveArraySegment(current, '[name=db]')).toEqual({ name: 'db' });
        });

        it('should resolve by condition key when guide array element has prefixed condition key', () => {
            const current = [
                { '[prod]': 'web', Description: 'Web guide' },
                { '[name=db]': 'db', Description: 'DB guide' }
            ];
            // 条件セレクタキーを持つガイド配列要素の解決検証
            expect(PathResolver.resolveArraySegment(current, '[name=db]')).toEqual({
                '[name=db]': 'db',
                Description: 'DB guide'
            });
        });

        it('should fallback to first element if not found by index', () => {
            const current = ['a', 'b'];
            expect(PathResolver.resolveArraySegment(current, '5')).toBe('a');
        });

        it('should return undefined if condition key is not matched', () => {
            const current = [{ name: 'web' }, { name: 'db' }];
            expect(PathResolver.resolveArraySegment(current, '[name=cache]')).toBeUndefined();
        });

        it('should resolve primitive array element by condition matcher containing double colons', () => {
            const current = ['other', 'AWS::LanguageExtensions', 'AWS::Serverless-2016-10-31'];
            // 二重コロンを含むプリミティブ要素の解決検証
            const resolved = PathResolver.resolveArraySegment(current, '[AWS::LanguageExtensions]');
            expect(resolved).toBe('AWS::LanguageExtensions');
        });

        it('should resolve primitive array element by condition matcher', () => {
            const current = ['dev', 'prod'];
            // プリミティブ配列要素の解決検証
            const resolved = PathResolver.resolveArraySegment(current, '[prod]');
            expect(resolved).toBe('prod');
        });

        it('should resolve by composite condition segment joined with ampersand', () => {
            const current = [
                { type: 'Service', name: 'api', Description: 'API Service' },
                { type: 'Service', name: 'worker', Description: 'Worker Service' }
            ];
            // アンパサンド結合された複合条件セグメントの解決検証
            const resolved = PathResolver.resolveArraySegment(current, '[type=Service&name=worker]');
            expect(resolved).toEqual({ type: 'Service', name: 'worker', Description: 'Worker Service' });
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
            expect(PathResolver.resolveObjectSegment(obj, '[prod]')).toBe('val1');
        });
    });
});
