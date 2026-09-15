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
                } else {
                    // 複合条件式の分割処理
                    const conditionParts = this.splitSerializedConditions(inside);
                    for (const part of conditionParts) {
                        const equalIdx = this.findSingleEqual(part);
                        if (equalIdx === -1) {
                            tokens.push({ type: 'match', key: part, value: '' });
                        } else {
                            const condKey = part.substring(0, equalIdx);
                            const condVal = part.substring(equalIdx + 1);
                            tokens.push({ type: 'match', key: condKey, value: condVal });
                        }
                    }
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

    // 単一イコール境界位置の特定
    public static findSingleEqual(str: string): number {
        let inQuote: string | null = null;
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === '\\' && i + 1 < str.length) {
                i++;
                continue;
            }
            if (inQuote) {
                if (char === inQuote) {
                    inQuote = null;
                }
                continue;
            }
            if (char === '"' || char === "'") {
                inQuote = char;
                continue;
            }
            if (char === '=') {
                const prev = i > 0 ? str[i - 1] : '';
                const next = i + 1 < str.length ? str[i + 1] : '';
                if (prev !== '=' && next !== '=') {
                    return i;
                }
                if (next === '=') {
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
                // 連続する角括弧の境界検出
                if (depth === 0 && char === ']' && i + 1 < serializedKey.length && serializedKey[i + 1] === '[') {
                    if (current) {
                        parts.push(current);
                        current = '';
                    }
                }
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

    /**
     * トークンが要素セレクタであるかの判定
     */
    static isElementSelector(token: PathToken): boolean {
        return token.type === 'match';
    }

    /**
     * パス文字列をセグメント文字列配列へ分解
     */
    static parseSegments(pathStr: string): string[] {
        const tokens = this.parse(pathStr);
        return tokens.map((t) => {
            if (t.type === 'prop') return t.name;
            if (t.type === 'array') return '[]';
            const valPart = t.value ? `=${t.value}` : '';
            return `[${t.key}${valPart}]`;
        });
    }

    /**
     * パストークン配列をパス文字列へ復元
     */
    static tokensToPath(tokens: PathToken[]): string {
        let result = '';
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.type === 'prop') {
                result += (i === 0 ? '' : '.') + token.name;
            } else if (token.type === 'array') {
                result += '[]';
            } else if (token.type === 'match') {
                const valPart = token.value ? `=${token.value}` : '';
                result += `[${token.key}${valPart}]`;
            }
        }
        return result;
    }

    /**
     * 指定パスに対する正規化候補キー一覧の導出
     */
    static getNormalizedKeys(key: string): Set<string> {
        const keys = new Set<string>();
        // 原型キーの登録
        keys.add(key);

        let tokens: PathToken[];
        try {
            // パス文字列の構文解析実行
            tokens = this.parse(key);
        } catch {
            return keys;
        }

        const hasSelector = tokens.some((t) => this.isElementSelector(t));
        const endsWithSelectorOrArray =
            tokens.length > 0 &&
            (this.isElementSelector(tokens[tokens.length - 1]) || tokens[tokens.length - 1].type === 'array');

        // 要素指定を配列指定へ置換したパスの導出
        if (hasSelector) {
            const selectorToArrayTokens: PathToken[] = tokens.map((t) =>
                this.isElementSelector(t) ? { type: 'array' } : t
            );
            // 配列置換パスの登録
            keys.add(this.tokensToPath(selectorToArrayTokens));
        }

        // 末尾要素指定の除去による親パスの導出
        if (endsWithSelectorOrArray && tokens.length > 1) {
            const strippedTokens: PathToken[] = tokens
                .slice(0, tokens.length - 1)
                .map((t) => (this.isElementSelector(t) ? { type: 'array' } : t));
            // 親パスの登録
            keys.add(this.tokensToPath(strippedTokens));
        }

        // 単一プロパティ名と末尾指定で構成される場合の基底プロパティ名導出
        if (
            tokens.length === 2 &&
            tokens[0].type === 'prop' &&
            (this.isElementSelector(tokens[1]) || tokens[1].type === 'array')
        ) {
            // 基底プロパティ名の登録
            keys.add(tokens[0].name);
        }

        return keys;
    }

    /**
     * 指定パスにおける上位の先祖パス一覧の導出
     */
    static getAncestorPaths(key: string): string[] {
        let tokens: PathToken[];
        try {
            tokens = this.parse(key);
        } catch {
            return [];
        }

        const ancestors: string[] = [];
        // 先頭から1トークンずつ追加しながら祖先パスを生成
        for (let i = 1; i < tokens.length; i++) {
            const ancestorPath = this.tokensToPath(tokens.slice(0, i));
            if (ancestorPath && ancestorPath !== key) {
                ancestors.push(ancestorPath);
            }
        }
        return ancestors;
    }

    /**
     * 先祖パスがいずれか除外設定されているかの判定
     */
    static isAncestorExcluded(key: string, doc: Record<string, any>): boolean {
        // 先祖パス一覧の取得
        const ancestors = this.getAncestorPaths(key);
        for (const ancestor of ancestors) {
            if (doc[ancestor] === true) {
                return true;
            }
            if (doc[`${ancestor}.*`] === true) {
                return true;
            }
        }
        return false;
    }
}
