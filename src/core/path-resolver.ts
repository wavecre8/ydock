import { YamlValue, DocDockDocument } from '../types';
import { DocDockConstants } from './constants';
import { ModeStrategy } from '../modes/types';
import { ConditionEvaluator } from './condition-evaluator';

export class PathResolver {
    static isPrimitive(val: unknown): val is string | number | boolean | null | undefined {
        return val === null || typeof val !== 'object';
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
        let matchedElement: YamlValue = undefined;

        const idx = parseInt(seg, 10);
        if (!isNaN(idx)) {
            if (idx < current.length) {
                matchedElement = current[idx];
            }
        } else if (seg.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix)) {
            // シリアライズ条件に基づく合致要素の探索
            matchedElement = current.find(el => ConditionEvaluator.matchesSerializedCondition(el, seg));
        }

        if (matchedElement === undefined && current.length > 0) {
            matchedElement = current[0];
        }

        return matchedElement;
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
        if (!isNaN(idx) || seg.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix)) {
            const values = Object.values(obj);
            if (values.length > 0) {
                return values[0];
            }
        }

        return undefined;
    }
}
