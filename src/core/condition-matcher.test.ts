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
            const desc = [{ '=type': 'A' }, { '=type': 'B' }];
            const segment = matcher.getMatchingConditionSegment(item, desc);
            expect(segment).toBe('=type:A');
        });

        it('should get segment from object with _match array (alias merged structure)', () => {
            const item = { type: 'A' };
            const desc = {
                _match: [
                    { '=type': 'B' },
                    { '=type': 'A' }
                ]
            };
            const segment = matcher.getMatchingConditionSegment(item, desc);
            expect(segment).toBe('=type:A');
        });

        it('should return undefined if no match found in _match array', () => {
            const item = { type: 'C' };
            const desc = {
                _match: [
                    { '=type': 'B' },
                    { '=type': 'A' }
                ]
            };
            const segment = matcher.getMatchingConditionSegment(item, desc);
            expect(segment).toBeUndefined();
        });
    });
});
