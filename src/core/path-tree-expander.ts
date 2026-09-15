import { merge } from 'lodash';
import { DocDockConstants } from './constants';
import { PathParser, PathToken } from './path-parser';

/**
 * フラットなパスキー構造を階層ツリー構造へ展開する汎用ユーティリティクラス
 */
export class PathTreeExpander {
    /**
     * フラットキーを含むオブジェクトを階層ツリー構造へ展開
     */
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
            let i = 0;
            while (i < tokens.length) {
                const token = tokens[i];
                if (token.type === 'match') {
                    // 連続する条件トークン群の収集
                    const matchTokens: Extract<PathToken, { type: 'match' }>[] = [];
                    while (i < tokens.length && tokens[i].type === 'match') {
                        matchTokens.push(tokens[i] as Extract<PathToken, { type: 'match' }>);
                        i++;
                    }
                    const isLast = i === tokens.length;
                    currentObj = this.applyCompositeMatchTokens(
                        currentObj,
                        matchTokens,
                        processedValue,
                        isLast,
                        terminalKey
                    );
                } else {
                    const isLast = i === tokens.length - 1;
                    const nextKey = token.type === 'prop' ? token.name : DocDockConstants.ReservedKeys.Array;
                    currentObj = this.applyPropOrArrayToken(currentObj, nextKey, processedValue, isLast, terminalKey);
                    i++;
                }
            }
        }
        return result;
    }

    private static applySinglePropToken(
        result: Record<string, any>,
        propName: string,
        processedValue: any,
        terminalKey: string
    ): void {
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

    private static applyCompositeMatchTokens(
        currentObj: any,
        matchTokens: Extract<PathToken, { type: 'match' }>[],
        processedValue: any,
        isLast: boolean,
        terminalKey: string
    ): any {
        const matchKey = DocDockConstants.ReservedKeys.Match;
        if (!currentObj[matchKey]) currentObj[matchKey] = [];

        const expectedSelectorKeys = matchTokens.map((t) => (t.value ? `[${t.key}=${t.value}]` : `[${t.key}]`));

        // 全条件キーが完全一致する既存マッチャーの探索
        let matcher = currentObj[matchKey].find((m: any) => {
            if (!m || typeof m !== 'object') return false;
            const mConditionKeys = Object.keys(m).filter((k) => k.startsWith('[') && k.endsWith(']'));
            if (mConditionKeys.length !== matchTokens.length) return false;
            return expectedSelectorKeys.every((k) => k in m);
        });

        if (!matcher) {
            matcher = {};
            for (let j = 0; j < matchTokens.length; j++) {
                const t = matchTokens[j];
                const sKey = expectedSelectorKeys[j];
                matcher[sKey] = t.value;
            }
            currentObj[matchKey].push(matcher);
        }

        if (isLast) {
            // 単一キー構成かつ値が空のスカラーマッチャー判定
            if (matchTokens.length === 1 && matchTokens[0].value === '') {
                matcher[expectedSelectorKeys[0]] = processedValue;
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

    private static applyPropOrArrayToken(
        currentObj: any,
        nextKey: string,
        processedValue: any,
        isLast: boolean,
        terminalKey: string
    ): any {
        if (!currentObj[nextKey]) {
            currentObj[nextKey] = {};
        } else if (typeof currentObj[nextKey] !== 'object' || currentObj[nextKey] === null) {
            currentObj[nextKey] = { [terminalKey]: currentObj[nextKey] };
        }

        if (isLast) {
            if (typeof processedValue === 'object' && processedValue !== null) {
                merge(currentObj[nextKey], processedValue);
            } else {
                currentObj[nextKey][terminalKey] = processedValue;
            }
            return currentObj;
        } else {
            return currentObj[nextKey];
        }
    }
}
