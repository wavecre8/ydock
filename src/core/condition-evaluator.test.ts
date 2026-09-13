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

        it('should match structured object condition against JSON serialized string', () => {
            const item = { Assert: { FnEquals: ['prod', 'prod'] } };
            const guide = { '=Assert': '{"FnEquals":["prod","prod"]}' };
            // 構造化オブジェクト値とJSONシリアライズ文字列の条件合致検証
            expect(ConditionEvaluator.matchesConditions(item, guide, ['=Assert'])).toBe(true);
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

        it('should match serialized condition containing double colons for primitive item', () => {
            const item = 'AWS::LanguageExtensions';
            const serialized = '=AWS::LanguageExtensions';
            // 二重コロンを含むプリミティブ値の条件合致検証
            expect(ConditionEvaluator.matchesSerializedCondition(item, serialized)).toBe(true);
        });

        it('should match serialized condition with value containing double colons for object item', () => {
            const item = { Type: 'AWS::EC2::Instance' };
            const serialized = '=Type:AWS::EC2::Instance';
            // 二重コロンを含むオブジェクト値の条件合致検証
            expect(ConditionEvaluator.matchesSerializedCondition(item, serialized)).toBe(true);
        });

        it('should match structured object condition accurately and reject different object', () => {
            const item = {
                Assert: {
                    FnEquals: ['prod', 'prod']
                }
            };
            const matchedGuide = {
                '=Assert': {
                    FnEquals: ['prod', 'prod']
                }
            };
            const differentGuide = {
                '=Assert': {
                    FnEquals: ['prod', 'stg']
                }
            };

            // 同一構造のオブジェクト条件に対する合致検証
            expect(ConditionEvaluator.matchesConditions(item, matchedGuide, ['=Assert'])).toBe(true);
            // 異なる構造のオブジェクト条件に対する不一致検証
            expect(ConditionEvaluator.matchesConditions(item, differentGuide, ['=Assert'])).toBe(false);
        });

        it('should match serialized condition with json stringified object', () => {
            const item = {
                Assert: {
                    FnEquals: ['prod', 'prod']
                }
            };
            const serialized = '=Assert:{"FnEquals":["prod","prod"]}';
            // シリアライズされたオブジェクト条件との合致検証
            expect(ConditionEvaluator.matchesSerializedCondition(item, serialized)).toBe(true);

            const differentSerialized = '=Assert:{"FnEquals":["prod","stg"]}';
            // 異なるシリアライズ条件との不一致検証
            expect(ConditionEvaluator.matchesSerializedCondition(item, differentSerialized)).toBe(false);
        });
    });

    describe('getSegmentFromArray', () => {
        it('should generate serialized json segment without object stringification for structured condition', () => {
            const item = {
                Assert: {
                    FnEquals: ['prod', 'prod']
                }
            };
            const arr = [
                {
                    '=Assert': {
                        FnEquals: ['prod', 'prod']
                    }
                }
            ];

            // セグメント文字列生成処理の実行
            const segment = ConditionEvaluator.getSegmentFromArray(item, arr);
            expect(segment).toBe('=Assert:{"FnEquals":["prod","prod"]}');
            expect(segment).not.toContain('[object Object]');
        });
    });

    describe('splitSerializedConditions', () => {
        it('should split simple conditions with ampersand', () => {
            const result = ConditionEvaluator.splitSerializedConditions('=type:A&=status:active');
            expect(result).toEqual(['=type:A', '=status:active']);
        });

        it('should not split ampersands inside json or brackets', () => {
            const serialized = '=Assert:{"FnEquals":["a&b","c"]}&=status:active';
            const result = ConditionEvaluator.splitSerializedConditions(serialized);
            expect(result).toEqual(['=Assert:{"FnEquals":["a&b","c"]}', '=status:active']);
        });
    });
});
