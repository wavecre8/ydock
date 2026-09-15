import { YamlValue, DocDockDocument } from '../types';
import { ModeStrategy } from '../modes/types';
import { ConditionEvaluator } from './condition-evaluator';

export class PathResolver {
    /**
     * ドット記法のパス文字列をセグメント配列に分解します。
     * 例: "tasks[name=web].image" -> ["tasks", "[name:web]", "image"]
     * 例: "tasks[0].image" -> ["tasks", "0", "image"]
     */
    public static parse(path: string): string[] {
        if (!path) return [];

        const segments: string[] = [];
        // ドットで分割するがブラケット内は分割しない正規表現
        const parts = path.split(/\.(?![^[]*\])/g);

        for (const part of parts) {
            const bracketMatch = part.match(/^([^[]+)\[(.*)\]$/);
            if (bracketMatch) {
                // プロパティ名とブラケット条件の分割
                segments.push(bracketMatch[1]);
                const condition = bracketMatch[2];
                // 数値インデックスまたは条件キーの判定
                if (/^\d+$/.test(condition)) {
                    segments.push(condition);
                } else {
                    segments.push(`[${condition}]`);
                }
            } else {
                segments.push(part);
            }
        }
        return segments;
    }

    // プリミティブ型判定処理の委譲
    static isPrimitive(val: unknown): val is string | number | boolean | null | undefined {
        return ConditionEvaluator.isPrimitive(val);
    }

    static findGuideByPath(doc: DocDockDocument | undefined, rawPath: string[], strategy?: ModeStrategy): YamlValue {
        if (!doc || !doc.description) return undefined;

        let current: YamlValue = doc.description;

        for (const seg of rawPath) {
            if (current === undefined || current === null) {
                return undefined;
            }

            if (Array.isArray(current)) {
                current = this.resolveArraySegment(current, seg);
            } else if (typeof current === 'object') {
                current = this.resolveObjectSegment(current as Record<string, YamlValue>, seg, strategy);
            } else {
                return undefined;
            }
        }
        return current;
    }

    static resolveArraySegment(current: YamlValue[], seg: string): YamlValue {
        // シリアライズ条件に基づく合致要素の探索
        const matchedElement = current.find((el) => ConditionEvaluator.matchesSerializedCondition(el, seg));
        if (matchedElement !== undefined) {
            return matchedElement;
        }

        const idx = parseInt(seg, 10);
        if (!isNaN(idx)) {
            if (idx < current.length) {
                return current[idx];
            } else if (current.length > 0) {
                return current[0];
            }
        } else if (
            ConditionEvaluator.isConditionKey(seg) ||
            seg.startsWith('[') ||
            seg.includes(':') ||
            seg.includes('=')
        ) {
            // 条件指定に合致しない場合は先頭要素へフォールバックせず未定義を返却
            return undefined;
        } else if (current.length > 0) {
            return current[0];
        }

        return undefined;
    }

    static resolveObjectSegment(obj: Record<string, YamlValue>, seg: string, strategy?: ModeStrategy): YamlValue {
        if (seg in obj) {
            return obj[seg];
        }

        if (strategy && strategy.findPropertyFallback) {
            const fallback = strategy.findPropertyFallback(obj, seg);
            if (fallback !== undefined) {
                return fallback;
            }
        }

        const idx = parseInt(seg, 10);
        if (!isNaN(idx)) {
            // インデックス指定の場合は先頭プロパティ値へフォールバック
            const values = Object.values(obj);
            if (values.length > 0) {
                return values[0];
            }
        } else if (ConditionEvaluator.isConditionKey(seg) || seg.includes(':')) {
            // 条件指定の場合は先頭要素が条件を持たない汎用定義である場合のみフォールバック
            const values = Object.values(obj);
            if (values.length > 0) {
                const first = values[0];
                const hasCondition =
                    first &&
                    typeof first === 'object' &&
                    Object.keys(first).some((k) => ConditionEvaluator.isConditionKey(k));
                if (!hasCondition) {
                    return first;
                }
            }
        }

        return undefined;
    }
}
