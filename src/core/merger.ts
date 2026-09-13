import { mergeWith, isArray, isObject, isEqual } from 'lodash';
import { YamlTemplate, YamlValue } from '../types';
import { DocDockConstants } from './constants';

export class Merger {
    /**
     * Merges multiple description objects into one.
     * Later keys overwrite earlier keys.
     * Accepts an optional customizer for mergeWith.
     */
    static mergeDescriptions(
        sources: YamlTemplate[],
        customizer?: (
            objValue: YamlValue,
            srcValue: YamlValue,
            key: string,
            object: YamlValue,
            source: YamlValue,
            stack: unknown
        ) => unknown
    ): YamlTemplate {
        const defaultCustomizer = (objValue: any, srcValue: any, key: string, object: any, source: any, stack: any) => {
            if (customizer) {
                const customResult = customizer(objValue, srcValue, key, object, source, stack);
                if (customResult !== undefined) {
                    return customResult;
                }
            }

            if (isArray(objValue) && isArray(srcValue)) {
                return Merger.mergeArrays(objValue, srcValue, defaultCustomizer);
            }

            // 空文字列による既存オブジェクトや非空文字列の上書き防止
            if (objValue !== undefined && objValue !== null && objValue !== '' && srcValue === '') {
                return objValue;
            }

            // 既存オブジェクトに対する非空文字列マージ時のDescription設定
            if (Merger.isPlainObjectOrRecord(objValue) && typeof srcValue === 'string' && srcValue !== '') {
                return { ...objValue, [DocDockConstants.ReservedKeys.DescriptionUpper]: srcValue };
            }

            // 既存非空文字列に対するオブジェクトマージ時のDescription保持
            if (typeof objValue === 'string' && objValue !== '' && Merger.isPlainObjectOrRecord(srcValue)) {
                return { [DocDockConstants.ReservedKeys.DescriptionUpper]: objValue, ...srcValue };
            }
        };

        return mergeWith({}, ...sources, defaultCustomizer);
    }

    private static isPlainObjectOrRecord(val: unknown): boolean {
        return isObject(val) && val !== null && !isArray(val);
    }

    private static getConditionKeys(item: unknown): string[] {
        if (!Merger.isPlainObjectOrRecord(item)) return [];
        return Object.keys(item as Record<string, unknown>).filter(k => k.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix));
    }

    private static findIndexByConditions(array: any[], srcItem: any, conditionKeys: string[]): number {
        return array.findIndex(objItem => {
            if (!Merger.isPlainObjectOrRecord(objItem)) return false;
            const objConditionKeys = Merger.getConditionKeys(objItem);
            // 条件キー総数の一致検証
            if (objConditionKeys.length !== conditionKeys.length) return false;

            return conditionKeys.every(cKey => {
                if (!(cKey in objItem)) return false;
                const objVal = (objItem as any)[cKey];
                const srcVal = (srcItem as any)[cKey];

                // 単一キー構成の要素はスカラー値に対するマッチャーであるためキー一致で合致判定
                const objKeys = Object.keys(objItem);
                const srcKeys = Object.keys(srcItem);
                if (objKeys.length === 1 && srcKeys.length === 1 && objKeys[0] === cKey && srcKeys[0] === cKey) {
                    return true;
                }

                // 構造化条件値に対する深い等価比較判定
                if (typeof objVal === 'object' && objVal !== null && typeof srcVal === 'object' && srcVal !== null) {
                    return isEqual(objVal, srcVal);
                }

                // 一方のみがオブジェクトである場合の不一致判定
                if ((typeof objVal === 'object' && objVal !== null) || (typeof srcVal === 'object' && srcVal !== null)) {
                    return false;
                }

                // プレースホルダー空文字列を含む場合は合致判定
                if (objVal === '' || srcVal === '') {
                    return true;
                }

                // オブジェクト属性に対する条件指定の場合は条件値の完全一致を検証
                return objVal === srcVal;
            });
        });
    }

    private static mergeArrays(objValue: any[], srcValue: any[], customizer: any): any[] {
        const result = [...objValue];
        
        for (let i = 0; i < srcValue.length; i++) {
            const srcItem = srcValue[i];
            const isMerged = Merger.mergeByConditions(result, srcItem, customizer);
            if (!isMerged) {
                Merger.mergeByIndex(result, srcItem, i, customizer);
            }
        }
        
        return result;
    }

    private static mergeByConditions(result: any[], srcItem: any, customizer: any): boolean {
        const conditionKeys = Merger.getConditionKeys(srcItem);
        if (conditionKeys.length === 0) return false;

        const matchedIndex = Merger.findIndexByConditions(result, srcItem, conditionKeys);
        if (matchedIndex >= 0) {
            result[matchedIndex] = mergeWith({}, result[matchedIndex], srcItem, customizer);
        } else {
            result.push(srcItem);
        }
        return true;
    }

    private static mergeByIndex(result: any[], srcItem: any, index: number, customizer: any): void {
        if (index < result.length) {
            if (isObject(result[index]) && isObject(srcItem)) {
                result[index] = mergeWith({}, result[index], srcItem, customizer);
            } else {
                result[index] = srcItem;
            }
        } else {
            result.push(srcItem);
        }
    }

    /**
     * Merges an alias object structure (with _alias, [], _match) with an array of guide items.
     * Elements of the array are distributed into _match or [] based on their condition keys.
     */
    static mergeAliasObjectWithArray(aliasObj: Record<string, any>, guideArray: any[], customizer: any): Record<string, any> {
        const mergedObj = { ...aliasObj };
        const matchKey = DocDockConstants.ReservedKeys.Match;
        const arrKey = DocDockConstants.ReservedKeys.Array;
        
        for (const guideItem of guideArray) {
            if (Merger.getConditionKeys(guideItem).length > 0) {
                mergedObj[matchKey] = mergedObj[matchKey] || [];
                Merger.mergeByConditions(mergedObj[matchKey] as any[], guideItem, customizer);
            } else {
                mergedObj[arrKey] = mergeWith({}, mergedObj[arrKey] || {}, guideItem, customizer);
            }
        }
        
        return mergedObj;
    }

    /**
     * Custom merge logic for guide resolution, extracted from ConditionMatcher.
     */
    static customGuideMerge(baseElementDesc: any, matchedOverride: any): any {
        return mergeWith({}, baseElementDesc, matchedOverride, function customizer(objValue: any, srcValue: any): any {
            if (typeof objValue === 'object' && objValue !== null && !Array.isArray(objValue) && typeof srcValue === 'string') {
                return { ...objValue, [DocDockConstants.ReservedKeys.DescriptionUpper]: srcValue };
            }
            if (typeof objValue === 'string' && typeof srcValue === 'object' && srcValue !== null && !Array.isArray(srcValue)) {
                return { ...srcValue, [DocDockConstants.ReservedKeys.DescriptionUpper]: objValue };
            }
            
            if (typeof objValue === 'object' && objValue !== null && !Array.isArray(objValue) && Array.isArray(srcValue)) {
                // 既存オブジェクトと後続配列の衝突マージ処理
                return Merger.mergeAliasObjectWithArray(
                    objValue as Record<string, any>,
                    srcValue as any[],
                    customizer
                );
            }

            if (Array.isArray(objValue) && typeof srcValue === 'object' && srcValue !== null && !Array.isArray(srcValue)) {
                // 既存配列と後続オブジェクトの衝突マージ処理
                return Merger.mergeAliasObjectWithArray(
                    srcValue as Record<string, any>,
                    objValue as any[],
                    customizer
                );
            }

            return undefined;
        });
    }
}
