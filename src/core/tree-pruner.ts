import { DocDockDocument, YamlValue } from '../types';
import { ConditionMatcher } from './condition-matcher';
import { DocDockConstants } from './constants';

/**
 * 除外定義ツリーに基づいてテンプレートデータから不要ノードを刈り取るクラス
 */
export class TreePruner {
    /**
     * ドキュメントのテンプレートに対して除外定義ツリーを適用
     */
    static prune(doc: DocDockDocument, matcher: ConditionMatcher): DocDockDocument {
        if (!doc.template || !doc.excludeTree) return doc;

        // ノードの再帰的刈り取り実行
        const newTemplate = this.pruneNode(doc.template, doc.excludeTree, matcher);

        return {
            ...doc,
            template:
                newTemplate && typeof newTemplate === 'object' && !Array.isArray(newTemplate)
                    ? (newTemplate as Record<string, YamlValue>)
                    : {}
        };
    }

    /**
     * 除外ツリー配下に保持指定ノードが存在するかの判定
     */
    private static hasFalseDescendant(excludeNode: YamlValue): boolean {
        if (excludeNode === false) return true;
        if (!excludeNode || typeof excludeNode !== 'object') return false;
        const nodeRecord = excludeNode as Record<string, YamlValue>;
        if (nodeRecord[DocDockConstants.ReservedKeys.ExcludeValue] === false) return true;

        for (const key of Object.keys(nodeRecord)) {
            if (key === DocDockConstants.ReservedKeys.ExcludeValue) continue;
            const childVal = nodeRecord[key];
            if (Array.isArray(childVal)) {
                for (const item of childVal) {
                    if (this.hasFalseDescendant(item)) return true;
                }
            } else {
                if (this.hasFalseDescendant(childVal)) return true;
            }
        }
        return false;
    }

    /**
     * ノードごとの再帰的刈り取り処理
     */
    private static pruneNode(data: YamlValue, excludeNode: YamlValue, matcher: ConditionMatcher): YamlValue {
        if (data === undefined) return undefined;

        const isExcludeTrue =
            typeof excludeNode === 'boolean'
                ? excludeNode
                : excludeNode &&
                  typeof excludeNode === 'object' &&
                  !Array.isArray(excludeNode) &&
                  (excludeNode as Record<string, YamlValue>)[DocDockConstants.ReservedKeys.ExcludeValue] === true;
        const hasFalseChild = this.hasFalseDescendant(excludeNode);

        if (isExcludeTrue && !hasFalseChild) {
            return undefined;
        }

        if (typeof data !== 'object' || data === null) {
            if (isExcludeTrue) {
                return undefined;
            }
            return data;
        }

        if (Array.isArray(data)) {
            const newArray: YamlValue[] = [];
            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                let itemExclude = matcher.findMatchingGuide(item, excludeNode, i) as YamlValue;

                if (isExcludeTrue) {
                    if (itemExclude === undefined) {
                        itemExclude = true;
                    } else if (
                        typeof itemExclude === 'object' &&
                        itemExclude !== null &&
                        !Array.isArray(itemExclude) &&
                        (itemExclude as Record<string, YamlValue>)[DocDockConstants.ReservedKeys.ExcludeValue] ===
                            undefined
                    ) {
                        itemExclude = { ...itemExclude, [DocDockConstants.ReservedKeys.ExcludeValue]: true };
                    }
                }

                // 配列要素の再帰刈り取り実行
                const prunedItem = this.pruneNode(item, itemExclude, matcher);
                if (prunedItem !== undefined) {
                    newArray.push(prunedItem);
                }
            }
            if (data.length > 0 && newArray.length === 0) {
                return undefined;
            }
            return newArray;
        }

        const newObj: Record<string, YamlValue> = {};
        const dataRecord = data as Record<string, YamlValue>;
        const excludeRecord =
            excludeNode && typeof excludeNode === 'object' && !Array.isArray(excludeNode)
                ? (excludeNode as Record<string, YamlValue>)
                : undefined;

        const wildcardExclude = excludeRecord ? excludeRecord['*'] : undefined;

        for (const [key, value] of Object.entries(dataRecord)) {
            // プロパティ固有またはワイルドカード除外設定の取得
            let childExclude = excludeRecord
                ? excludeRecord[key] !== undefined
                    ? excludeRecord[key]
                    : wildcardExclude
                : undefined;

            if (isExcludeTrue) {
                if (childExclude === undefined) {
                    childExclude = true;
                } else if (
                    typeof childExclude === 'object' &&
                    childExclude !== null &&
                    !Array.isArray(childExclude) &&
                    (childExclude as Record<string, YamlValue>)[DocDockConstants.ReservedKeys.ExcludeValue] ===
                        undefined
                ) {
                    childExclude = { ...childExclude, [DocDockConstants.ReservedKeys.ExcludeValue]: true };
                }
            }

            // オブジェクトプロパティの再帰刈り取り実行
            const prunedValue = this.pruneNode(value, childExclude, matcher);
            if (prunedValue !== undefined) {
                newObj[key] = prunedValue;
            }
        }

        const originalKeys = Object.keys(dataRecord);
        if (originalKeys.length > 0 && Object.keys(newObj).length === 0) {
            return undefined;
        }
        return newObj;
    }
}
