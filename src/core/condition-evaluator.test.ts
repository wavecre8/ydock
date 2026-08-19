import { describe, it, expect } from 'vitest';
import { ConditionEvaluator } from './condition-evaluator';

describe('ConditionEvaluator', () => {
    describe('isPrimitive', () => {
        it('should return true for primitives', () => {
            expect(ConditionEvaluator.isPrimitive('string')).toBe(true);
            expect(ConditionEvaluator.isPrimitive(123)).toBe(true);
            expect(ConditionEvaluator.isPrimitive(true)).toBe(true);
            expect(ConditionEvaluator.isPrimitive(null)).toBe(true);
            expect(ConditionEvaluator.isPrimitive(undefined)).toBe(true);
        });

        it('should return false for objects and arrays', () => {
            expect(ConditionEvaluator.isPrimitive({})).toBe(false);
            expect(ConditionEvaluator.isPrimitive([])).toBe(false);
        });
    });

    describe('matchesConditions', () => {
        it('should match conditions for objects', () => {
            const item = { type: 'A', value: 1 };
            const guide = { '=type': 'A' };
            expect(ConditionEvaluator.matchesConditions(item, guide, ['=type'])).toBe(true);
        });

        it('should not match if conditions differ', () => {
            const item = { type: 'A', value: 1 };
            const guide = { '=type': 'B' };
            expect(ConditionEvaluator.matchesConditions(item, guide, ['=type'])).toBe(false);
        });

        it('should self-match conditions for preview mode', () => {
            // item itself contains the condition key, representing the preview mode behavior
            const item = { '=type': 'A', value: 1 };
            const guide = { '=type': 'A' };
            expect(ConditionEvaluator.matchesConditions(item, guide, ['=type'])).toBe(true);
        });

        it('should not self-match if values differ in preview mode', () => {
            const item = { '=type': 'A', value: 1 };
            const guide = { '=type': 'B' };
            expect(ConditionEvaluator.matchesConditions(item, guide, ['=type'])).toBe(false);
        });
    });

    describe('matchesSerializedCondition', () => {
        it('should match multiple serialized conditions', () => {
            const item = { type: 'A', status: 'active' };
            const serialized = '=type:A&=status:active';
            expect(ConditionEvaluator.matchesSerializedCondition(item, serialized)).toBe(true);
        });

        it('should fail if one condition does not match', () => {
            const item = { type: 'A', status: 'inactive' };
            const serialized = '=type:A&=status:active';
            expect(ConditionEvaluator.matchesSerializedCondition(item, serialized)).toBe(false);
        });
    });
});
