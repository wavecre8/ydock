import { isEqual } from 'lodash';
import { YamlValue } from '../types';
import { PathParser } from './path-parser';

export class ConditionEvaluator {
    static isPrimitive(val: unknown): val is string | number | boolean | null | undefined {
        return val === null || typeof val !== 'object';
    }

    // セレクタキーであるかの判定
    static isConditionKey(key: string): boolean {
        return key.startsWith('[') && key.endsWith(']');
    }

    // 条件付きオブジェクトまたはガイド要素同士の同一性合致判定
    static areConditionItemsMatching(
        itemA: unknown,
        itemB: unknown,
        matchStructureWhenNoConditions: boolean = false
    ): boolean {
        // オブジェクト型判定
        if (typeof itemA !== 'object' || itemA === null || typeof itemB !== 'object' || itemB === null) {
            return false;
        }

        const objA = itemA as Record<string, unknown>;
        const objB = itemB as Record<string, unknown>;

        // 条件キー群の抽出
        const condKeysA = Object.keys(objA).filter((k) => ConditionEvaluator.isConditionKey(k));
        const condKeysB = Object.keys(objB).filter((k) => ConditionEvaluator.isConditionKey(k));

        // 条件キー総数の一致検証
        if (condKeysA.length !== condKeysB.length) {
            return false;
        }

        // 条件キーが存在する場合の合致判定
        if (condKeysA.length > 0) {
            return condKeysA.every((cKey) => {
                if (!(cKey in objB)) return false;
                const valA = objA[cKey];
                const valB = objB[cKey];

                // スカラーマッチャーにおけるキー合致判定
                const keysA = Object.keys(objA);
                const keysB = Object.keys(objB);
                const isSingleKey = keysA.length === 1 && keysB.length === 1 && keysA[0] === cKey && keysB[0] === cKey;

                // スカラーマッチャーペア間でのプレースホルダー空文字列の合致判定
                if (isSingleKey && (valA === '' || valB === '')) {
                    return true;
                }

                if (
                    isSingleKey &&
                    ((typeof valA === 'object' && valA !== null) || (typeof valB === 'object' && valB !== null))
                ) {
                    return true;
                }

                // 構造化条件値に対する深い等価比較判定
                if (typeof valA === 'object' && valA !== null && typeof valB === 'object' && valB !== null) {
                    return isEqual(valA, valB);
                }

                // 一方のみがオブジェクトである場合の不一致判定
                if ((typeof valA === 'object' && valA !== null) || (typeof valB === 'object' && valB !== null)) {
                    return false;
                }

                // スカラー条件値の完全一致判定
                return valA === valB;
            });
        }

        // 条件キーが存在しないオブジェクト配列要素のキー構造一致判定
        if (matchStructureWhenNoConditions) {
            const keysA = Object.keys(objA);
            const keysB = Object.keys(objB);
            if (keysA.length > 0 && keysA.length === keysB.length) {
                return keysA.every((k) => k in objB);
            }
        }

        return false;
    }

    static matchesConditions(item: YamlValue, guideObj: Record<string, YamlValue>, conditionKeys: string[]): boolean {
        return conditionKeys.every((cKey) => {
            const inner = cKey.startsWith('[') && cKey.endsWith(']') ? cKey.slice(1, -1) : cKey;
            const equalIdx = PathParser.findSingleEqual(inner);

            if (equalIdx !== -1) {
                const actualKey = inner.substring(0, equalIdx);
                const expectedValue = inner.substring(equalIdx + 1);

                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                    const objItem = item as Record<string, YamlValue>;
                    if (actualKey in objItem) {
                        return this.isConditionValueEqual(objItem[actualKey], expectedValue);
                    }
                    if (cKey in objItem) {
                        return this.isConditionValueEqual(objItem[cKey], expectedValue);
                    }
                }
                return false;
            } else {
                const actualKey = inner;

                if (this.isPrimitive(item)) {
                    return String(item) === actualKey;
                }

                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                    const objItem = item as Record<string, YamlValue>;
                    if (actualKey in objItem || cKey in objItem) {
                        return true;
                    }
                    // ガイドオブジェクト値と照合
                    if (actualKey in guideObj) {
                        return this.isConditionValueEqual(objItem[actualKey], guideObj[actualKey]);
                    }
                }

                return false;
            }
        });
    }

    static matchesSerializedCondition(item: YamlValue, serializedKey: string): boolean {
        let inner = serializedKey;
        if (inner.startsWith('[') && inner.endsWith(']')) {
            // 文字列全体が単一の角括弧ペアで囲まれているかの判定
            let depth = 0;
            let isSingleWrapped = true;
            for (let i = 0; i < inner.length - 1; i++) {
                if (inner[i] === '[') depth++;
                else if (inner[i] === ']') depth--;
                if (depth === 0) {
                    isSingleWrapped = false;
                    break;
                }
            }
            if (isSingleWrapped) {
                inner = inner.slice(1, -1);
            }
        }

        // トップレベル条件区切りによる分割処理
        const parts = this.splitSerializedConditions(inner);
        return parts.every((part) => {
            // 個別条件要素の両端角括弧の除去処理
            const cleanedPart = part.startsWith('[') && part.endsWith(']') ? part.slice(1, -1) : part;
            // 二重イコールを除外した単一イコール境界位置の取得
            const equalIdx = PathParser.findSingleEqual(cleanedPart);
            if (equalIdx !== -1) {
                const actualKey = cleanedPart.substring(0, equalIdx);
                const expectedVal = cleanedPart.substring(equalIdx + 1);

                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                    const objItem = item as Record<string, YamlValue>;
                    // 属性値とシリアライズされた条件値との等価性検証
                    if (actualKey in objItem) {
                        return this.isSerializedValueEqual(objItem[actualKey], expectedVal);
                    }
                    if (cleanedPart in objItem) {
                        return this.isSerializedValueEqual(objItem[cleanedPart], expectedVal);
                    }
                    if (part in objItem) {
                        return this.isSerializedValueEqual(objItem[part], expectedVal);
                    }
                    const wrappedKey = `[${cleanedPart}]`;
                    if (wrappedKey in objItem) {
                        const val = objItem[wrappedKey];
                        return val === '' || this.isSerializedValueEqual(val, expectedVal);
                    }
                }
                return false;
            } else {
                const actualKey = cleanedPart;

                if (this.isPrimitive(item)) {
                    return String(item) === actualKey || String(item) === part;
                }
                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                    const objItem = item as Record<string, YamlValue>;
                    const wrappedKey = `[${cleanedPart}]`;
                    return actualKey in objItem || part in objItem || wrappedKey in objItem;
                }
                return false;
            }
        });
    }

    static getSegmentFromArray(item: YamlValue, arr: YamlValue[]): string | undefined {
        for (const element of arr) {
            if (typeof element !== 'object' || element === null) continue;

            const guideObj = element as Record<string, YamlValue>;
            const conditionKeys = Object.keys(guideObj).filter((k) => ConditionEvaluator.isConditionKey(k));
            if (conditionKeys.length === 0) continue;

            // 条件キー群との一致判定
            if (this.matchesConditions(item, guideObj, conditionKeys)) {
                return conditionKeys.join('&');
            }
        }
        return undefined;
    }

    static getSegmentFromObject(item: YamlValue, obj: Record<string, YamlValue>): string | undefined {
        for (const key of Object.keys(obj)) {
            if (ConditionEvaluator.isConditionKey(key)) {
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
        if (
            typeof actualVal === 'object' &&
            actualVal !== null &&
            typeof expectedVal === 'object' &&
            expectedVal !== null
        ) {
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
