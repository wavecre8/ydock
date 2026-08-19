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
                const end = pathStr.indexOf(']', i);
                if (end === -1) throw new Error(`Unclosed bracket in path: ${pathStr}`);
                const inside = pathStr.substring(i + 1, end);
                if (inside === '') {
                    tokens.push({ type: 'array' });
                } else if (inside.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix)) {
                    const colonIdx = this.findSingleColon(inside);
                    if (colonIdx === -1) {
                        tokens.push({ type: 'match', key: inside, value: '' });
                    } else {
                        const condKey = inside.substring(0, colonIdx);
                        const condVal = inside.substring(colonIdx + 1);
                        tokens.push({ type: 'match', key: condKey, value: condVal });
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

    private static findSingleColon(str: string): number {
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
}
