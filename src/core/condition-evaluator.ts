import { YamlValue } from '../types';
import { DocDockConstants } from './constants';

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
                
                // Normal data matching
                if (actualKey in objItem) {
                    return String(objItem[actualKey]) === String(expectedValue);
                }
                
                // Self-matching for preview mode (where item is the guide file itself)
                if (cKey in objItem) {
                    return String(objItem[cKey]) === String(expectedValue);
                }
            }

            return false;
        });
    }

    static matchesSerializedCondition(item: YamlValue, serializedKey: string): boolean {
        const parts = serializedKey.split('&');
        return parts.every(part => {
            if (!part.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix)) return false;

            const colonIdx = part.indexOf(':');
            if (colonIdx !== -1) {
                const cKey = part.substring(0, colonIdx);
                const expectedVal = part.substring(colonIdx + 1);
                const actualKey = cKey.substring(1);

                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                    const objItem = item as Record<string, YamlValue>;
                    if (actualKey in objItem) {
                        return String(objItem[actualKey]) === expectedVal;
                    }
                    if (cKey in objItem) {
                        return String(objItem[cKey]) === expectedVal;
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

            if (this.matchesConditions(item, guideObj, conditionKeys)) {
                return conditionKeys
                    .map(cKey => this.isPrimitive(item) ? cKey : `${cKey}:${String(guideObj[cKey])}`)
                    .join('&');
            }
        }
        return undefined;
    }

    static getSegmentFromObject(item: YamlValue, obj: Record<string, YamlValue>): string | undefined {
        for (const key of Object.keys(obj)) {
            if (key.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix)) {
                if (this.matchesSerializedCondition(item, key)) {
                    return key;
                }
            }
        }
        return undefined;
    }
}
