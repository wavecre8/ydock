import { describe, it, expect } from 'vitest';
import { ConditionMatcher } from './condition-matcher';
import { DocDockConstants } from './constants';
import { GenericStrategy } from '../modes/generic';

describe('ConditionMatcher', () => {
    describe('extractMetadata', () => {
        const matcher = new ConditionMatcher(new GenericStrategy());

        it('should extract description', () => {
            const result = matcher.extractMetadata('My Desc');
            expect(result).toEqual({ description: 'My Desc', alias: undefined });
        });

        it('should extract from object with Description key', () => {
            const result = matcher.extractMetadata({ [DocDockConstants.ReservedKeys.DescriptionUpper]: 'Obj Desc' });
            expect(result).toEqual({ description: 'Obj Desc', alias: undefined });
        });

        it('should extract alias', () => {
            const result = matcher.extractMetadata({ [DocDockConstants.ReservedKeys.Alias]: 'My Alias' });
            expect(result).toEqual({ description: undefined, alias: 'My Alias' });
        });
    });

    describe('getMatchingConditionSegment', () => {
        const matcher = new ConditionMatcher(new GenericStrategy());

        it('should get segment from array', () => {
            const item = { type: 'A' };
            const desc = [{ '[type=A]': 'A' }, { '[type=B]': 'B' }];
            const segment = matcher.getMatchingConditionSegment(item, desc);
            expect(segment).toBe('[type=A]');
        });

        it('should get segment from object with _match array (alias merged structure)', () => {
            const item = { type: 'A' };
            const desc = {
                _match: [{ '[type=B]': 'B' }, { '[type=A]': 'A' }]
            };
            const segment = matcher.getMatchingConditionSegment(item, desc);
            expect(segment).toBe('[type=A]');
        });

        it('should return undefined if no match found in _match array', () => {
            const item = { type: 'C' };
            const desc = {
                _match: [{ '[type=B]': 'B' }, { '[type=A]': 'A' }]
            };
            const segment = matcher.getMatchingConditionSegment(item, desc);
            expect(segment).toBeUndefined();
        });
    });

    describe('findMatchingGuide fallback', () => {
        const matcher = new ConditionMatcher(new GenericStrategy());

        it('should not fallback to condition key when element does not match', () => {
            const item = { name: 'db' };
            const desc = {
                '[name=web]': { Description: 'Web container' }
            };
            // 条件不一致要素に対するガイド取得実行
            const result = matcher.findMatchingGuide(item, desc as any, 0);
            expect(result).toBeUndefined();
        });
    });
});
