import { SingleDocument, DocDockDocument, YamlValue } from '../types';
import { ModeStrategy } from '../modes/types';
import { ConditionMatcher } from './condition-matcher';
import { DocumentPreprocessor } from './document-preprocessor';
import { DocDockConstants } from './constants';

export interface IndexedDocument {
    docIndex: number;
    rawDoc: SingleDocument;
    currentDocPrefix: string;
    docMatcher: ConditionMatcher;
    processedSingleDoc: DocDockDocument;
    singleSections: string[];
    lowerKeySet: Set<string>;
    keyHierarchy: Map<string, Set<string>>;
    allChildKeys: Set<string>;
    grandChildHierarchy: Map<string, Set<string>>;
    childToSectionMap: Map<string, string>;
    childDirectProps: Map<string, Set<string>>;
    childNestedProps: Map<string, Set<string>>;
    propertiesKey?: string;
}

/**
 * ドキュメント内のキー構造を走査して検索用インデックスを構築および保持するクラス
 */
export class DocumentIndex {
    /**
     * 単一ドキュメントを前処理し検索用インデックス情報を構築
     */
    static indexDocument(
        rawDoc: SingleDocument,
        docIndex: number,
        isMultiDoc: boolean,
        parentDoc: DocDockDocument,
        strategy: ModeStrategy,
        sortSections: (sections: string[]) => string[],
        ignoredSections: string[]
    ): IndexedDocument {
        const singleDocObj: DocDockDocument = {
            template: rawDoc.template,
            description: rawDoc.description,
            excludeTree: rawDoc.excludeTree,
            mode: parentDoc.mode,
            sourcePath: rawDoc.sourcePath || parentDoc.sourcePath,
            sourceBaseName: rawDoc.sourceBaseName || parentDoc.sourceBaseName
        };
        const docMatcher = new ConditionMatcher(strategy, singleDocObj);
        // ドキュメントの前処理実行
        const processedSingleDoc = DocumentPreprocessor.process(singleDocObj, docMatcher);

        const singleRawSections = Object.keys(processedSingleDoc.template).filter((key) => {
            return !ignoredSections.includes(key);
        });
        // セクション順序の並び替え
        const singleSections = sortSections(singleRawSections);
        const currentDocPrefix = isMultiDoc ? `doc_${docIndex}` : '';

        const keyHierarchy = new Map<string, Set<string>>();
        const lowerKeySet = new Set<string>();
        const allChildKeys = new Set<string>();
        const grandChildHierarchy = new Map<string, Set<string>>();
        const childToSectionMap = new Map<string, string>();
        const childDirectProps = new Map<string, Set<string>>();
        const childNestedProps = new Map<string, Set<string>>();
        const propertiesKey =
            (strategy.getPropertiesKey ? strategy.getPropertiesKey() : undefined) ?? DocDockConstants.Cfn.PropertiesKey;

        // テンプレート内のトップレベルおよび子キー情報の収集
        for (const [topKey, sectionVal] of Object.entries(processedSingleDoc.template)) {
            const lowerTop = topKey.toLowerCase();
            lowerKeySet.add(lowerTop);

            const childSet = new Set<string>();
            if (typeof sectionVal === 'object' && sectionVal !== null && !Array.isArray(sectionVal)) {
                for (const [childKey, childVal] of Object.entries(sectionVal)) {
                    const lowerChild = childKey.toLowerCase();
                    childSet.add(lowerChild);
                    allChildKeys.add(lowerChild);
                    childToSectionMap.set(lowerChild, topKey);

                    // 子要素配下のプロパティ集合の収集
                    if (typeof childVal === 'object' && childVal !== null && !Array.isArray(childVal)) {
                        let propSet = grandChildHierarchy.get(lowerChild);
                        if (!propSet) {
                            propSet = new Set<string>();
                            grandChildHierarchy.set(lowerChild, propSet);
                        }
                        let directSet = childDirectProps.get(lowerChild);
                        if (!directSet) {
                            directSet = new Set<string>();
                            childDirectProps.set(lowerChild, directSet);
                        }
                        for (const propKey of Object.keys(childVal)) {
                            const lowerProp = propKey.toLowerCase();
                            propSet.add(lowerProp);
                            directSet.add(lowerProp);
                        }
                        // 戦略に基づくプロパティ配下のプロパティ集合収集
                        if (propertiesKey) {
                            const propsObj = (childVal as Record<string, YamlValue>)[propertiesKey];
                            if (typeof propsObj === 'object' && propsObj !== null && !Array.isArray(propsObj)) {
                                let nestedSet = childNestedProps.get(lowerChild);
                                if (!nestedSet) {
                                    nestedSet = new Set<string>();
                                    childNestedProps.set(lowerChild, nestedSet);
                                }
                                for (const propKey of Object.keys(propsObj)) {
                                    const lowerProp = propKey.toLowerCase();
                                    propSet.add(lowerProp);
                                    nestedSet.add(lowerProp);
                                }
                            }
                        }
                    }
                }
            }
            keyHierarchy.set(lowerTop, childSet);
        }

        return {
            docIndex,
            rawDoc,
            currentDocPrefix,
            docMatcher,
            processedSingleDoc,
            singleSections,
            lowerKeySet,
            keyHierarchy,
            allChildKeys,
            grandChildHierarchy,
            childToSectionMap,
            childDirectProps,
            childNestedProps,
            propertiesKey
        };
    }

    /**
     * インデックス化済みドキュメント群からキーに一致するドキュメント配列を探索
     */
    static findMatchingDocs(docs: IndexedDocument[], topLower: string, secondLower?: string): IndexedDocument[] {
        if (secondLower) {
            // トップレベルセクション名配下の子キーとしての一致を優先探索
            const topLevelMatches = docs.filter((d) => {
                if (!d.lowerKeySet.has(topLower)) return false;
                const childKeys = d.keyHierarchy.get(topLower);
                return childKeys ? childKeys.has(secondLower) : false;
            });
            if (topLevelMatches.length > 0) {
                return topLevelMatches;
            }

            // セクション名省略時における子キー配下のプロパティとしての探索フォールバック
            return docs.filter((d) => {
                const grandChildKeys = d.grandChildHierarchy.get(topLower);
                return grandChildKeys ? grandChildKeys.has(secondLower) : false;
            });
        }

        // 単一キー指定時はトップレベルキーでの一致を優先
        const topLevelMatches = docs.filter((d) => d.lowerKeySet.has(topLower));
        if (topLevelMatches.length > 0) {
            return topLevelMatches;
        }

        // トップレベルキーで一致しない場合は全子キー集合から一致を探索
        return docs.filter((d) => d.allChildKeys.has(topLower));
    }

    /**
     * 指定ドキュメントのインデックスに基づき短縮セグメント列を展開補完
     */
    static expandShortSegments(
        doc: IndexedDocument,
        segments: string[]
    ): { segments: string[]; isPropertiesBlock?: boolean } {
        if (segments.length === 0) {
            return { segments: [], isPropertiesBlock: undefined };
        }

        const resolved = [...segments];
        let isPropertiesBlock: boolean | undefined = undefined;
        const firstLower = resolved[0].toLowerCase();

        // 第1セグメントが子キーである場合のセクション名補完
        if (doc.childToSectionMap.has(firstLower)) {
            const sectionName = doc.childToSectionMap.get(firstLower)!;
            resolved.unshift(sectionName);
        }

        // リソース配下のプロパティ省略時の補完
        if (doc.propertiesKey && resolved.length >= 3) {
            const childLower = resolved[1].toLowerCase();
            const third = resolved[2];
            const thirdLower = third.toLowerCase();

            if (third !== doc.propertiesKey) {
                if (doc.childNestedProps.get(childLower)?.has(thirdLower)) {
                    resolved.splice(2, 0, doc.propertiesKey);
                    isPropertiesBlock = true;
                } else if (doc.childDirectProps.get(childLower)?.has(thirdLower)) {
                    isPropertiesBlock = false;
                }
            } else {
                isPropertiesBlock = true;
            }
        }

        return { segments: resolved, isPropertiesBlock };
    }
}
