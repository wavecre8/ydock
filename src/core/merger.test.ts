import { describe, it, expect } from 'vitest';
import { Merger } from './merger';
import { DocDockConstants } from './constants';

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

        it('should merge array elements based on prefix keys starting with =', () => {
            const source1 = {
                Transform: [
                    { "=AWS::LanguageExtensions": "Description 1", Key1: "val1" }
                ]
            };
            const source2 = {
                Transform: [
                    { "=AWS::LanguageExtensions": "Description 1", Key2: "val2" }
                ]
            };
            const result = Merger.mergeDescriptions([source1, source2]);
            expect(result).toEqual({
                Transform: [
                    { "=AWS::LanguageExtensions": "Description 1", Key1: "val1", Key2: "val2" }
                ]
            });
        });

        it('should append new condition elements and fallback by index for other elements', () => {
            const source1 = {
                items: [
                    "value1",
                    { "=id": "1", desc: "item 1" }
                ]
            };
            const source2 = {
                items: [
                    "value2",
                    { "=id": "2", desc: "item 2" }
                ]
            };
            const result = Merger.mergeDescriptions([source1, source2]);
            expect(result).toEqual({
                items: [
                    "value2",
                    { "=id": "1", desc: "item 1" },
                    { "=id": "2", desc: "item 2" }
                ]
            });
        });
    });

    describe('mergeAliasObjectWithArray', () => {
        it('should merge guide items with condition keys into _match array', () => {
            const aliasObj = { [DocDockConstants.ReservedKeys.Alias]: 'Containers' };
            const guideArray = [
                { '=name': 'web', cpu: 256 },
                { '=name': 'db', memory: 512 }
            ];
            
            const result = Merger.mergeAliasObjectWithArray(aliasObj, guideArray, undefined);
            
            expect(result).toEqual({
                [DocDockConstants.ReservedKeys.Alias]: 'Containers',
                [DocDockConstants.ReservedKeys.Match]: [
                    { '=name': 'web', cpu: 256 },
                    { '=name': 'db', memory: 512 }
                ]
            });
        });

        it('should merge guide items without condition keys into [] object', () => {
            const aliasObj = { [DocDockConstants.ReservedKeys.Alias]: 'Tags', [DocDockConstants.ReservedKeys.Array]: { Key: 'TagKey' } };
            const guideArray = [
                { Value: 'TagValue' }
            ];
            
            const result = Merger.mergeAliasObjectWithArray(aliasObj, guideArray, undefined);
            
            expect(result).toEqual({
                [DocDockConstants.ReservedKeys.Alias]: 'Tags',
                [DocDockConstants.ReservedKeys.Array]: { Key: 'TagKey', Value: 'TagValue' }
            });
        });

        it('should correctly merge multiple condition keys using existing matched item', () => {
            const aliasObj = { 
                [DocDockConstants.ReservedKeys.Alias]: 'Tasks',
                [DocDockConstants.ReservedKeys.Match]: [
                    { '=id': '1', name: 'task1' }
                ]
            };
            const guideArray = [
                { '=id': '1', status: 'running' },
                { '=id': '2', status: 'stopped' }
            ];
            
            const result = Merger.mergeAliasObjectWithArray(aliasObj, guideArray, undefined);
            
            expect(result).toEqual({
                [DocDockConstants.ReservedKeys.Alias]: 'Tasks',
                [DocDockConstants.ReservedKeys.Match]: [
                    { '=id': '1', name: 'task1', status: 'running' },
                    { '=id': '2', status: 'stopped' }
                ]
            });
        });
    });
});
