import { YamlValue, DocDockDocument } from '../types';
import { DocDockConstants } from './constants';
import { ModeStrategy } from '../modes/types';

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
            const parts = seg.split(':');
            const cKey = parts[0];
            const expectedVal = parts.slice(1).join(':');
            const actualKey = cKey.substring(1);

            matchedElement = current.find(el => {
                if (typeof el !== 'object' || el === null) return false;
                const elObj = el as Record<string, YamlValue>;
                return expectedVal ? String(elObj[actualKey]) === expectedVal : actualKey in elObj;
            });
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
