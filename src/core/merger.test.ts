import { describe, it, expect, vi } from 'vitest';
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

        it('should merge array elements based on selector keys', () => {
            const source1 = {
                Transform: [{ '[AWS=:LanguageExtensions]': 'Description 1', Key1: 'val1' }]
            };
            const source2 = {
                Transform: [{ '[AWS=:LanguageExtensions]': 'Description 1', Key2: 'val2' }]
            };
            const result = Merger.mergeDescriptions([source1, source2]);
            expect(result).toEqual({
                Transform: [{ '[AWS=:LanguageExtensions]': 'Description 1', Key1: 'val1', Key2: 'val2' }]
            });
        });

        it('should append new condition elements and fallback by index for other elements', () => {
            const source1 = {
                items: ['value1', { '[id=1]': '1', desc: 'item 1' }]
            };
            const source2 = {
                items: ['value2', { '[id=2]': '2', desc: 'item 2' }]
            };
            const result = Merger.mergeDescriptions([source1, source2]);
            expect(result).toEqual({
                items: ['value2', { '[id=1]': '1', desc: 'item 1' }, { '[id=2]': '2', desc: 'item 2' }]
            });
        });

        it('should retain existing object when subsequent value is empty string', () => {
            const source1 = {
                Transform: {
                    _match: [{ '[AWS=:LanguageExtensions]': { _alias: 'Language Extensions' } }]
                }
            };
            const source2 = {
                Transform: ''
            };
            // 空値による上書き抑止の検証
            const result = Merger.mergeDescriptions([source1, source2]);
            expect(result).toEqual({
                Transform: {
                    _match: [{ '[AWS=:LanguageExtensions]': { _alias: 'Language Extensions' } }]
                }
            });
        });

        it('should merge alias object and guide string into Description and _alias for condition matcher', () => {
            const aliasObj = {
                [DocDockConstants.ReservedKeys.Match]: [
                    { '[AWS=:LanguageExtensions]': { _alias: 'Language Extensions' } }
                ]
            };
            const guideArray = [{ '[AWS=:LanguageExtensions]': 'Extensions Description' }];

            // 条件指定要素に対する別名と説明文のマージ検証
            const result = Merger.mergeAliasObjectWithArray(aliasObj, guideArray);
            expect(result[DocDockConstants.ReservedKeys.Match]).toHaveLength(1);
            expect(result[DocDockConstants.ReservedKeys.Match][0]).toEqual({
                '[AWS=:LanguageExtensions]': {
                    _alias: 'Language Extensions',
                    Description: 'Extensions Description'
                }
            });
        });
    });

    describe('mergeAliasObjectWithArray', () => {
        it('should merge guide items with condition keys into _match array', () => {
            const aliasObj = { [DocDockConstants.ReservedKeys.Alias]: 'Containers' };
            const guideArray = [
                { '[name=web]': 'web', cpu: 256 },
                { '[name=db]': 'db', memory: 512 }
            ];

            const result = Merger.mergeAliasObjectWithArray(aliasObj, guideArray);

            expect(result).toEqual({
                [DocDockConstants.ReservedKeys.Alias]: 'Containers',
                [DocDockConstants.ReservedKeys.Match]: [
                    { '[name=web]': 'web', cpu: 256 },
                    { '[name=db]': 'db', memory: 512 }
                ]
            });
        });

        it('should merge guide items without condition keys into [] object', () => {
            const aliasObj = {
                [DocDockConstants.ReservedKeys.Alias]: 'Tags',
                [DocDockConstants.ReservedKeys.Array]: { Key: 'TagKey' }
            };
            const guideArray = [{ Value: 'TagValue' }];

            const result = Merger.mergeAliasObjectWithArray(aliasObj, guideArray);

            expect(result).toEqual({
                [DocDockConstants.ReservedKeys.Alias]: 'Tags',
                [DocDockConstants.ReservedKeys.Array]: { Key: 'TagKey', Value: 'TagValue' }
            });
        });

        it('should correctly merge multiple condition keys using existing matched item', () => {
            const aliasObj = {
                [DocDockConstants.ReservedKeys.Alias]: 'Tasks',
                [DocDockConstants.ReservedKeys.Match]: [{ '[id=1]': '1', name: 'task1' }]
            };
            const guideArray = [
                { '[id=1]': '1', status: 'running' },
                { '[id=2]': '2', status: 'stopped' }
            ];

            const result = Merger.mergeAliasObjectWithArray(aliasObj, guideArray);

            expect(result).toEqual({
                [DocDockConstants.ReservedKeys.Alias]: 'Tasks',
                [DocDockConstants.ReservedKeys.Match]: [
                    { '[id=1]': '1', name: 'task1', status: 'running' },
                    { '[id=2]': '2', status: 'stopped' }
                ]
            });
        });

        it('should not overmatch composite condition item when single condition key is merged', () => {
            const arr1 = [{ '[type=web]': 'web', '[env=prod]': 'prod', Description: 'Prod Web' }];
            const arr2 = [{ '[type=web]': 'web', Description: 'General Web' }];
            // 複合条件要素と部分一致する単一条件要素の独立性検証
            const result = Merger.mergeDescriptions([{ items: arr1 }, { items: arr2 }]) as any;
            expect(result.items).toHaveLength(2);
            expect(result.items[0]).toEqual({ '[type=web]': 'web', '[env=prod]': 'prod', Description: 'Prod Web' });
            expect(result.items[1]).toEqual({ '[type=web]': 'web', Description: 'General Web' });
        });

        it('should distinguish structured condition items when condition objects differ', () => {
            const arr1 = [{ '[Assert={"FnEquals":["prod","stg"]}]': '', Description: 'Prod Stg Rule' }];
            const arr2 = [{ '[Assert={"FnEquals":["dev","test"]}]': '', Description: 'Dev Test Rule' }];
            // 異なるオブジェクト条件値を持つ配列要素の独立保持検証
            const result = Merger.mergeDescriptions([{ rules: arr1 }, { rules: arr2 }]) as any;
            expect(result.rules).toHaveLength(2);
            expect(result.rules[0].Description).toBe('Prod Stg Rule');
            expect(result.rules[1].Description).toBe('Dev Test Rule');
        });

        it('should merge array and alias object symmetrically in customGuideMerge', () => {
            const baseObj = { tags: [{ '[name=primary]': 'primary', Description: 'Primary Guide' }] };
            const overrideObj = { tags: { _alias: 'Server Alias' } };

            // 既存配列と後続オブジェクトのマージ実行
            const result = Merger.customGuideMerge(baseObj, overrideObj);

            // _match配列および_aliasが保持されることを検証
            expect(result.tags._alias).toBe('Server Alias');
            expect(result.tags._match).toEqual(baseObj.tags);
        });

        it('should distinguish single key condition items when scalar values differ', () => {
            const arr1 = [{ '[Type=AWS::S3::Bucket]': 'AWS::S3::Bucket' }];
            const arr2 = [{ '[Type=AWS::SQS::Queue]': 'AWS::SQS::Queue' }];
            // 単一キー要素で値が異なる場合に別要素として保持される検証
            const result = Merger.mergeDescriptions([{ resources: arr1 }, { resources: arr2 }]) as any;
            expect(result.resources).toHaveLength(2);
            expect(result.resources[0]).toEqual({ '[Type=AWS::S3::Bucket]': 'AWS::S3::Bucket' });
            expect(result.resources[1]).toEqual({ '[Type=AWS::SQS::Queue]': 'AWS::SQS::Queue' });
        });
    });

    describe('guideCustomizer', () => {
        it('配列とオブジェクトの衝突時にMerger.mergeAliasObjectWithArrayを呼び出す', () => {
            const mergeSpy = vi.spyOn(Merger, 'mergeAliasObjectWithArray').mockReturnValue({ merged: true });

            const objValue = [{ '[name=test]': 'test' }];
            const srcValue = { _alias: 'TestAlias' };

            // カスタムマージ処理の実行
            const result = Merger.guideCustomizer(objValue, srcValue);

            expect(mergeSpy).toHaveBeenCalledWith(srcValue, objValue);
            expect(result).toEqual({ merged: true });
        });

        it('オブジェクトと配列の逆方向衝突時にMerger.mergeAliasObjectWithArrayを呼び出す', () => {
            const mergeSpy = vi.spyOn(Merger, 'mergeAliasObjectWithArray').mockReturnValue({ mergedReverse: true });

            const objValue = { _alias: 'ExistingAlias' };
            const srcValue = [{ '[name=test]': 'test' }];

            // 逆方向衝突時のカスタムマージ呼び出し検証
            const result = Merger.guideCustomizer(objValue, srcValue);

            expect(mergeSpy).toHaveBeenCalledWith(objValue, srcValue);
            expect(result).toEqual({ mergedReverse: true });
        });

        it('衝突条件に合致しない場合はundefinedを返却する', () => {
            // 文字列同士の非衝突マージ検証
            const result = Merger.guideCustomizer('str1', 'str2');
            expect(result).toBeUndefined();
        });
    });
});
