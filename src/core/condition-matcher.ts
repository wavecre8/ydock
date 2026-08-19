import { YamlValue, GuideMeta, DocDockDocument } from '../types';
import { DocDockConstants } from './constants';
import { Merger } from './merger';
import { cloneDeep } from 'lodash';
import { MetadataExtractor } from './metadata-extractor';
import { PathResolver } from './path-resolver';
import { ConditionEvaluator } from './condition-evaluator';
import { ModeStrategy } from '../modes/types';

export class ConditionMatcher {
    private doc?: DocDockDocument;
    private strategy: ModeStrategy;

    constructor(strategy: ModeStrategy, doc?: DocDockDocument) {
        this.strategy = strategy;
        this.doc = doc;
    }

    isPrimitive(val: unknown): val is string | number | boolean | null | undefined {
        return ConditionEvaluator.isPrimitive(val);
    }

    extractMetadata(desc: YamlValue): GuideMeta {
        return MetadataExtractor.extractMetadata(desc);
    }

    private findOverrideInArray(item: YamlValue, arr: YamlValue[]): YamlValue | undefined {
        for (const element of arr) {
            if (typeof element !== 'object' || element === null) continue;
            const obj = element as Record<string, YamlValue>;
            const conditionKeys = Object.keys(obj).filter(k => k.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix));
            
            if (conditionKeys.length === 0) continue;
            
            if (ConditionEvaluator.matchesConditions(item, obj, conditionKeys)) {
                return this.extractGuide(item, obj, conditionKeys);
            }
        }
        return undefined;
    }

    findMatchingGuide(item: YamlValue, desc: YamlValue, index: number, _rawPath: string[] = []): YamlValue {
        if (!desc || typeof desc !== 'object') {
            return undefined;
        }

        if (Array.isArray(desc)) {
            return this.findOverrideInArray(item, desc) ?? this.getFallbackGuide(desc, index);
        }

        const descObj = desc as Record<string, YamlValue>;
        const matchKey = DocDockConstants.ReservedKeys.Match;
        let matchedOverride: YamlValue = undefined;

        if (Array.isArray(descObj[matchKey])) {
            matchedOverride = this.findOverrideInArray(item, descObj[matchKey]);
        }

        let baseElementDesc: YamlValue = undefined;
        const arrayKey = DocDockConstants.ReservedKeys.Array;
        if (descObj[arrayKey] !== undefined) {
            baseElementDesc = descObj[arrayKey];
        }

        if (baseElementDesc === undefined && descObj[index] !== undefined) {
            baseElementDesc = descObj[index];
        }

        if (baseElementDesc && matchedOverride) {
            return Merger.customGuideMerge(cloneDeep(baseElementDesc), matchedOverride);
        }

        return matchedOverride || baseElementDesc;
    }

    getMatchingConditionSegment(item: YamlValue, desc: YamlValue, rawPath: string[] = []): string | undefined {
        const activeDesc = desc || (rawPath && rawPath.length > 0 ? PathResolver.findGuideByPath(this.doc, rawPath, this.strategy) : undefined);

        if (Array.isArray(activeDesc)) {
            return ConditionEvaluator.getSegmentFromArray(item, activeDesc);
        }

        if (typeof activeDesc === 'object' && activeDesc !== null) {
            const descObj = activeDesc as Record<string, YamlValue>;
            const matchKey = DocDockConstants.ReservedKeys.Match;
            
            if (Array.isArray(descObj[matchKey])) {
                const segment = ConditionEvaluator.getSegmentFromArray(item, descObj[matchKey]);
                if (segment) return segment;
            }
            
            return ConditionEvaluator.getSegmentFromObject(item, descObj);
        }

        return undefined;
    }

    private getFallbackGuide(desc: YamlValue, index: number): YamlValue {
        if (!Array.isArray(desc)) {
            if (typeof desc === 'object' && desc !== null) {
                const obj = desc as Record<string, YamlValue>;
                if (index in obj) {
                    return obj[index];
                }
                const values = Object.values(obj);
                if (values.length > 0) {
                    return values[0];
                }
            }
            return undefined;
        }

        const fallbackElement = desc[index];
        if (typeof fallbackElement === 'object' && fallbackElement !== null) {
            const hasCondition = Object.keys(fallbackElement).some(k => k.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix));
            if (!hasCondition) {
                return fallbackElement;
            }
        } else if (this.isPrimitive(fallbackElement)) {
            return fallbackElement;
        }
        return undefined;
    }

    private extractGuide(item: YamlValue, guideObj: Record<string, YamlValue>, conditionKeys: string[]): YamlValue {
        if (this.isPrimitive(item)) {
            return guideObj[conditionKeys[0]];
        }

        const result: Record<string, YamlValue> = {};
        for (const k of Object.keys(guideObj)) {
            if (!k.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix)) {
                result[k] = guideObj[k];
            }
        }
        return Object.keys(result).length > 0 ? result : undefined;
    }

    public resolveArraySegment(current: YamlValue[], seg: string): YamlValue {
        return PathResolver.resolveArraySegment(current, seg);
    }

    public resolveObjectSegment(obj: Record<string, YamlValue>, seg: string): YamlValue {
        return PathResolver.resolveObjectSegment(obj, seg, this.strategy);
    }
}
