import { describe, it, expect } from 'vitest';
import { CfnStrategy } from './cfn';

describe('CfnStrategy', () => {
    const strategy = new CfnStrategy();

    describe('isIntrinsic', () => {
        it('should classify !Ref as intrinsic', () => {
            expect(strategy.isIntrinsic({ '!Ref': 'MyResource' })).toBe(true);
        });

        it('should classify Fn::Sub as intrinsic', () => {
            expect(strategy.isIntrinsic({ 'Fn::Sub': '${Var}' })).toBe(true);
        });

        it('should not classify regular objects as intrinsic', () => {
            expect(strategy.isIntrinsic({ Type: 'AWS::S3::Bucket' })).toBe(false);
        });

        it('should not classify null as intrinsic', () => {
            expect(strategy.isIntrinsic(null)).toBe(false);
        });

        it('should not classify primitives as intrinsic', () => {
            expect(strategy.isIntrinsic('string')).toBe(false);
            expect(strategy.isIntrinsic(123)).toBe(false);
        });
    });

    describe('getMergeableKeys', () => {
        it('should return standard CFn sections', () => {
            const keys = strategy.getMergeableKeys();
            expect(keys).toContain('Resources');
            expect(keys).toContain('Parameters');
            expect(keys).toContain('Outputs');
        });
    });

    describe('getCustomizer', () => {
        it('should merge Transform arrays uniquely', () => {
            const customizer = strategy.getCustomizer();
            const result = customizer(['Transform1'], ['Transform2'], 'Transform', undefined, undefined, undefined);
            expect(result).toEqual(['Transform1', 'Transform2']);
        });

        it('should handle duplicate transforms', () => {
            const customizer = strategy.getCustomizer();
            const result = customizer(['T1'], ['T1', 'T2'], 'Transform', undefined, undefined, undefined);
            expect(result).toEqual(['T1', 'T2']);
        });

        it('should return undefined for other keys', () => {
            const customizer = strategy.getCustomizer();
            const result = customizer({}, {}, 'Parameters', undefined, undefined, undefined);
            expect(result).toBeUndefined();
        });
    });

    describe('getSectionSortOrder', () => {
        it('should define a specific sort order', () => {
            const order = strategy.getSectionSortOrder();
            expect(order).toBeDefined();
            expect(order![0]).toBe('AWSTemplateFormatVersion');
        });
    });
});
