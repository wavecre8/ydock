import { merge } from 'lodash';
import { DocDockConstants } from './constants';
import { PathParser, PathToken } from './path-parser';

export class AliasTreeBuilder {
    static build(data: any, terminalKey: string = DocDockConstants.ReservedKeys.Alias): any {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return data;
        }

        const result: Record<string, any> = {};

        for (const [key, value] of Object.entries(data)) {
            if (key === DocDockConstants.ReservedKeys.Imports) continue;

            const processedValue = this.build(value, terminalKey);
            const tokens = PathParser.parse(key);

            const firstToken = tokens[0];
            if (tokens.length === 1 && firstToken.type === 'prop') {
                this.applySinglePropToken(result, firstToken.name, processedValue, terminalKey);
                continue;
            }

            let currentObj = result;
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                const isLast = i === tokens.length - 1;

                if (token.type === 'match') {
                    currentObj = this.applyMatchToken(currentObj, token, processedValue, isLast, terminalKey);
                } else {
                    const nextKey = token.type === 'prop' ? token.name : DocDockConstants.ReservedKeys.Array;
                    currentObj = this.applyPropOrArrayToken(currentObj, nextKey, processedValue, isLast, terminalKey);
                }
            }
        }
        return result;
    }

    private static applySinglePropToken(result: Record<string, any>, propName: string, processedValue: any, terminalKey: string): void {
        if (typeof result[propName] === 'object' && result[propName] !== null) {
            if (typeof processedValue === 'object' && processedValue !== null) {
                merge(result[propName], processedValue);
            } else {
                result[propName][terminalKey] = processedValue;
            }
        } else {
            if (result[propName] !== undefined && typeof processedValue === 'object' && processedValue !== null) {
                const prevVal = result[propName];
                result[propName] = processedValue;
                result[propName][terminalKey] = prevVal;
            } else {
                result[propName] = processedValue;
            }
        }
    }

    private static applyMatchToken(currentObj: any, token: Extract<PathToken, { type: 'match' }>, processedValue: any, isLast: boolean, terminalKey: string): any {
        const matchKey = DocDockConstants.ReservedKeys.Match;
        // 直前トークンがmatchでありcurrentObjがマッチャー自身である場合の複合条件処理
        if (typeof currentObj === 'object' && currentObj !== null && !Array.isArray(currentObj) && !(matchKey in currentObj)) {
            const hasCondition = Object.keys(currentObj).some(k => k.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix));
            if (hasCondition) {
                currentObj[token.key] = token.value;
                if (isLast) {
                    if (token.value === '') {
                        currentObj[token.key] = processedValue;
                    } else if (typeof processedValue === 'object' && processedValue !== null) {
                        merge(currentObj, processedValue);
                    } else {
                        currentObj[terminalKey] = processedValue;
                    }
                }
                return currentObj;
            }
        }

        if (!currentObj[matchKey]) currentObj[matchKey] = [];
        
        let matcher = currentObj[matchKey].find((m: any) => m[token.key] === token.value);
        if (!matcher) {
            matcher = { [token.key]: token.value };
            currentObj[matchKey].push(matcher);
        }
        
        if (isLast) {
            if (token.value === '') {
                matcher[token.key] = processedValue;
            } else {
                if (typeof processedValue === 'object' && processedValue !== null) {
                    merge(matcher, processedValue);
                } else {
                    matcher[terminalKey] = processedValue;
                }
            }
            return currentObj;
        } else {
            return matcher;
        }
    }

    private static applyPropOrArrayToken(currentObj: any, nextKey: string, processedValue: any, isLast: boolean, terminalKey: string): any {
        if (!currentObj[nextKey]) {
            currentObj[nextKey] = {};
        } else if (typeof currentObj[nextKey] !== 'object' || currentObj[nextKey] === null) {
            currentObj[nextKey] = { [terminalKey]: currentObj[nextKey] };
        }

        if (isLast) {
            if (typeof currentObj[nextKey] === 'object' && currentObj[nextKey] !== null) {
                if (typeof processedValue === 'object' && processedValue !== null) {
                    merge(currentObj[nextKey], processedValue);
                } else {
                    currentObj[nextKey][terminalKey] = processedValue;
                }
            } else {
                if (currentObj[nextKey] !== undefined && typeof processedValue === 'object' && processedValue !== null) {
                    const prevVal = currentObj[nextKey];
                    currentObj[nextKey] = processedValue;
                    currentObj[nextKey][terminalKey] = prevVal;
                } else {
                    currentObj[nextKey] = processedValue;
                }
            }
            return currentObj;
        } else {
            return currentObj[nextKey];
        }
    }
}
