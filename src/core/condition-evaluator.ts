import { isEqual } from 'lodash';
import { YamlValue } from '../types';
import { DocDockConstants } from './constants';
import { PathParser } from './path-parser';

export class ConditionEvaluator {
    static isPrimitive(val: unknown): val is string | number | boolean | null | undefined {
        return val === null || typeof val !== 'object';
    }

    static matchesConditions(item: YamlValue, guideObj: Record<string, YamlValue>, conditionKeys: string[]): boolean {
        return conditionKeys.every(cKey => {
            const expectedValue = guideObj[cKey];

            if (this.isPrimitive(item)) {
                return cKey === `${DocDockConstants.ReservedKeys.ConditionPrefix}${String(item)}`;
            }

            if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                const actualKey = cKey.substring(1);
                const objItem = item as Record<string, YamlValue>;
                
                // オブジェクト属性値と条件期待値の同一性判定
                if (actualKey in objItem) {
                    return this.isConditionValueEqual(objItem[actualKey], expectedValue);
                }
                
                // ガイドファイル自己参照時の条件同一性判定
                if (cKey in objItem) {
                    return this.isConditionValueEqual(objItem[cKey], expectedValue);
                }
            }

            return false;
        });
    }

    static matchesSerializedCondition(item: YamlValue, serializedKey: string): boolean {
        // トップレベル条件区切りによる分割処理
        const parts = this.splitSerializedConditions(serializedKey);
        return parts.every(part => {
            if (!part.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix)) return false;

            // 二重コロンを除外した単一コロン境界位置の取得
            const colonIdx = PathParser.findSingleColon(part);
            if (colonIdx !== -1) {
                const cKey = part.substring(0, colonIdx);
                const expectedVal = part.substring(colonIdx + 1);
                const actualKey = cKey.substring(1);

                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                    const objItem = item as Record<string, YamlValue>;
                    // 属性値とシリアライズされた条件値との等価性検証
                    if (actualKey in objItem) {
                        return this.isSerializedValueEqual(objItem[actualKey], expectedVal);
                    }
                    // ガイド自己参照時の等価性検証
                    if (cKey in objItem) {
                        return this.isSerializedValueEqual(objItem[cKey], expectedVal);
                    }
                }
                return false;
            } else {
                const cKey = part;
                const actualKey = cKey.substring(1);

                if (this.isPrimitive(item)) {
                    return cKey === `${DocDockConstants.ReservedKeys.ConditionPrefix}${String(item)}`;
                }
                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                    const objItem = item as Record<string, YamlValue>;
                    return actualKey in objItem || cKey in objItem;
                }
                return false;
            }
        });
    }

    static getSegmentFromArray(item: YamlValue, arr: YamlValue[]): string | undefined {
        for (const element of arr) {
            if (typeof element !== 'object' || element === null) continue;

            const guideObj = element as Record<string, YamlValue>;
            const conditionKeys = Object.keys(guideObj).filter(k => k.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix));
            if (conditionKeys.length === 0) continue;

            // 条件キー群との一致判定
            if (this.matchesConditions(item, guideObj, conditionKeys)) {
                return conditionKeys
                    .map(cKey => {
                        if (this.isPrimitive(item)) {
                            return cKey;
                        }
                        const val = guideObj[cKey];
                        // 構造化条件値のシリアライズ文字列生成
                        if (typeof val === 'object' && val !== null) {
                            return `${cKey}:${JSON.stringify(val)}`;
                        }
                        return `${cKey}:${String(val)}`;
                    })
                    .join('&');
            }
        }
        return undefined;
    }

    static getSegmentFromObject(item: YamlValue, obj: Record<string, YamlValue>): string | undefined {
        for (const key of Object.keys(obj)) {
            if (key.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix)) {
                // シリアライズ条件文字列との照合
                if (this.matchesSerializedCondition(item, key)) {
                    return key;
                }
            }
        }
        return undefined;
    }

    // 条件値同士の等価性判定
    private static isConditionValueEqual(actualVal: unknown, expectedVal: unknown): boolean {
        // オブジェクト値同士に対する深い等価比較の適用
        if (typeof actualVal === 'object' && actualVal !== null && typeof expectedVal === 'object' && expectedVal !== null) {
            return isEqual(actualVal, expectedVal);
        }

        // オブジェクトと文字列間におけるJSONパース比較の適用
        if (typeof actualVal === 'object' && actualVal !== null && typeof expectedVal === 'string') {
            try {
                const parsed = JSON.parse(expectedVal);
                return isEqual(actualVal, parsed);
            } catch {
                return false;
            }
        }
        if (typeof actualVal === 'string' && typeof expectedVal === 'object' && expectedVal !== null) {
            try {
                const parsed = JSON.parse(actualVal);
                return isEqual(parsed, expectedVal);
            } catch {
                return false;
            }
        }

        if (typeof actualVal === 'object' && actualVal !== null) return false;
        if (typeof expectedVal === 'object' && expectedVal !== null) return false;

        return String(actualVal) === String(expectedVal);
    }

    // シリアライズされた条件値文字列との等価性判定
    private static isSerializedValueEqual(actualVal: unknown, expectedStr: string): boolean {
        // オブジェクト値の場合はJSONパースによる復元比較を実行
        if (typeof actualVal === 'object' && actualVal !== null) {
            try {
                const parsed = JSON.parse(expectedStr);
                return isEqual(actualVal, parsed);
            } catch {
                return false;
            }
        }
        return String(actualVal) === expectedStr;
    }

    // シリアライズされた条件文字列の分割処理
    public static splitSerializedConditions(serializedKey: string): string[] {
        return PathParser.splitSerializedConditions(serializedKey);
    }
}
