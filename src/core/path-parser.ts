import { DocDockConstants } from './constants';

export type PathToken =
    | { type: 'prop'; name: string }
    | { type: 'array' }
    | { type: 'match'; key: string; value: string };

export class PathParser {
    /**
     * Parses a string path (e.g. "a.b[=c:d].e") into an array of PathTokens.
     */
    static parse(pathStr: string): PathToken[] {
        const tokens: PathToken[] = [];
        let current = '';
        let i = 0;
        while (i < pathStr.length) {
            const char = pathStr[i];
            if (char === '\\' && i + 1 < pathStr.length) {
                current += pathStr[i + 1];
                i += 2;
                continue;
            }
            if (char === '.') {
                if (current) {
                    tokens.push({ type: 'prop', name: current });
                    current = '';
                }
                i++;
                continue;
            }
            if (char === '[') {
                if (current) {
                    tokens.push({ type: 'prop', name: current });
                    current = '';
                }
                // 対応する閉じ括弧位置の探索
                let depth = 1;
                let end = -1;
                let inQuote: string | null = null;
                for (let j = i + 1; j < pathStr.length; j++) {
                    const c = pathStr[j];
                    if (c === '\\' && j + 1 < pathStr.length) {
                        j++;
                        continue;
                    }
                    if (inQuote) {
                        if (c === inQuote) {
                            inQuote = null;
                        }
                        continue;
                    }
                    if (c === '"' || c === "'") {
                        inQuote = c;
                        continue;
                    }
                    if (c === '[') {
                        depth++;
                    } else if (c === ']') {
                        depth--;
                        if (depth === 0) {
                            end = j;
                            break;
                        }
                    }
                }
                if (end === -1) throw new Error(`Unclosed bracket in path: ${pathStr}`);
                const inside = pathStr.substring(i + 1, end);
                if (inside === '') {
                    tokens.push({ type: 'array' });
                } else if (inside.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix)) {
                    // 複合条件式の分割処理
                    const conditionParts = this.splitSerializedConditions(inside);
                    for (const part of conditionParts) {
                        const colonIdx = this.findSingleColon(part);
                        if (colonIdx === -1) {
                            tokens.push({ type: 'match', key: part, value: '' });
                        } else {
                            const condKey = part.substring(0, colonIdx);
                            const condVal = part.substring(colonIdx + 1);
                            tokens.push({ type: 'match', key: condKey, value: condVal });
                        }
                    }
                } else {
                    tokens.push({ type: 'prop', name: inside });
                }
                i = end + 1;
                continue;
            }
            current += char;
            i++;
        }
        if (current) {
            tokens.push({ type: 'prop', name: current });
        }
        return tokens;
    }

    // 二重コロンを除外した単一コロン境界位置の特定
    public static findSingleColon(str: string): number {
        for (let i = 0; i < str.length; i++) {
            if (str[i] === ':') {
                const prev = i > 0 ? str[i - 1] : '';
                const next = i + 1 < str.length ? str[i + 1] : '';
                if (prev !== ':' && next !== ':') {
                    return i;
                }
                if (next === ':') {
                    i++;
                }
            }
        }
        return -1;
    }

    // シリアライズされた条件文字列の分割処理
    public static splitSerializedConditions(serializedKey: string): string[] {
        const parts: string[] = [];
        let current = '';
        let depth = 0;
        let inQuote: string | null = null;

        for (let i = 0; i < serializedKey.length; i++) {
            const char = serializedKey[i];
            if (char === '\\' && i + 1 < serializedKey.length) {
                current += char + serializedKey[i + 1];
                i++;
                continue;
            }
            if (inQuote) {
                current += char;
                if (char === inQuote) {
                    inQuote = null;
                }
                continue;
            }
            if (char === '"' || char === "'") {
                inQuote = char;
                current += char;
                continue;
            }
            if (char === '[' || char === '{') {
                depth++;
                current += char;
                continue;
            }
            if (char === ']' || char === '}') {
                depth--;
                current += char;
                continue;
            }
            if (char === '&' && depth === 0) {
                if (current) {
                    parts.push(current);
                    current = '';
                }
                continue;
            }
            current += char;
        }
        if (current) {
            parts.push(current);
        }
        return parts;
    }
}
