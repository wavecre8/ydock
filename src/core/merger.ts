import { mergeWith, isArray, isObject, cloneDeep } from 'lodash';
import { YamlTemplate, YamlValue } from '../types';
import { DocDockConstants } from './constants';
import { ConditionEvaluator } from './condition-evaluator';

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
        return Object.keys(item as Record<string, unknown>).filter((k) => ConditionEvaluator.isConditionKey(k));
    }

    private static findIndexByConditions(array: any[], srcItem: any, _conditionKeys: string[]): number {
        return array.findIndex((objItem) => {
            // 条件一致判定処理の委譲
            return ConditionEvaluator.areConditionItemsMatching(objItem, srcItem, false);
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
            // カスタムマージ関数による型衝突の安全な解決処理
            const customResult = customizer
                ? customizer(result[index], srcItem, String(index), result, result, null)
                : undefined;
            if (customResult !== undefined) {
                result[index] = customResult;
            } else if (isObject(result[index]) && isObject(srcItem)) {
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
    static mergeAliasObjectWithArray(
        aliasObj: Record<string, any>,
        guideArray: any[]
    ): Record<string, any> {
        // 参照元オブジェクトの破壊的変更を防止するための複製
        const mergedObj = cloneDeep(aliasObj);
        const matchKey = DocDockConstants.ReservedKeys.Match;
        const arrKey = DocDockConstants.ReservedKeys.Array;

        for (const guideItem of guideArray) {
            if (Merger.getConditionKeys(guideItem).length > 0) {
                mergedObj[matchKey] = mergedObj[matchKey] || [];
                Merger.mergeByConditions(mergedObj[matchKey] as any[], guideItem, Merger.guideCustomizer);
            } else {
                mergedObj[arrKey] = mergeWith({}, mergedObj[arrKey] || {}, guideItem, Merger.guideCustomizer);
            }
        }

        return mergedObj;
    }

    /**
     * ガイドとエイリアスを統合するカスタムマージ関数
     */
    static guideCustomizer(objValue: unknown, srcValue: unknown): unknown {
        const descKey = DocDockConstants.ReservedKeys.DescriptionUpper;
        if (
            typeof objValue === 'string' &&
            typeof srcValue === 'object' &&
            srcValue !== null &&
            !Array.isArray(srcValue)
        ) {
            return { [descKey]: objValue, ...srcValue };
        }
        if (
            typeof objValue === 'object' &&
            objValue !== null &&
            !Array.isArray(objValue) &&
            typeof srcValue === 'string'
        ) {
            return { ...objValue, [descKey]: srcValue };
        }

        if (Array.isArray(objValue) && typeof srcValue === 'object' && srcValue !== null && !Array.isArray(srcValue)) {
            // 配列とオブジェクトの衝突マージ処理
            return Merger.mergeAliasObjectWithArray(srcValue as Record<string, any>, objValue as any[]);
        }

        if (typeof objValue === 'object' && objValue !== null && !Array.isArray(objValue) && Array.isArray(srcValue)) {
            // オブジェクトと配列の衝突マージ処理
            return Merger.mergeAliasObjectWithArray(objValue as Record<string, any>, srcValue as any[]);
        }

        return undefined;
    }

    /**
     * Custom merge logic for guide resolution, extracted from ConditionMatcher.
     */
    static customGuideMerge(baseElementDesc: any, matchedOverride: any): any {
        // カスタムマージ関数によるガイド結合の実行
        return mergeWith({}, baseElementDesc, matchedOverride, Merger.guideCustomizer);
    }
}
