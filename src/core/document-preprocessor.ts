import { DocDockDocument } from '../types';
import { ConditionMatcher } from './condition-matcher';
import { DocDockConstants } from './constants';
import { TreePruner } from './tree-pruner';

export class DocumentPreprocessor {
    static process(doc: DocDockDocument, matcher: ConditionMatcher): DocDockDocument {
        if (!doc.template) return doc;

        // 除外ツリーに基づくテンプレートノードの刈り取り
        const prunedDoc = TreePruner.prune(doc, matcher);
        const strategy = matcher.getStrategy();
        // モード戦略に応じたテンプレート構造の正規化
        const newTemplate =
            strategy && typeof strategy.normalizeTemplate === 'function'
                ? strategy.normalizeTemplate(prunedDoc.template, {
                      mode: doc.mode,
                      sourcePath: doc.sourcePath,
                      sourceBaseName: doc.sourceBaseName
                  })
                : { ...prunedDoc.template };
        const newDescription = prunedDoc.description ? { ...prunedDoc.description } : undefined;

        for (const sectionName of Object.keys(newTemplate)) {
            const templateVal = newTemplate[sectionName];
            const descVal = newDescription ? newDescription[sectionName] : undefined;

            if (Array.isArray(templateVal)) {
                const newTemplateObj: Record<string, any> = {};
                const newDescObj: Record<string, any> = {};

                templateVal.forEach((item, index) => {
                    const itemDesc = matcher.findMatchingGuide(item, descVal, index);
                    // 一意なセグメント識別子の導出
                    const { segment } = matcher.deriveUniqueSegment(item, descVal, index, (s) => s in newTemplateObj);

                    newTemplateObj[segment] = item;
                    if (newDescription && itemDesc !== undefined) {
                        newDescObj[segment] = itemDesc;
                    }
                });

                newTemplate[sectionName] = newTemplateObj;
                if (newDescription) {
                    if (typeof descVal === 'string') {
                        // 文字列形式によるセクション説明文の保持
                        newDescObj[DocDockConstants.ReservedKeys.DescriptionUpper] = descVal;
                    } else if (typeof descVal === 'object' && descVal !== null) {
                        Object.keys(descVal).forEach((k) => {
                            // 予約語プレフィックス、条件セレクタキー、セクション説明文キーの保持
                            if (
                                k.startsWith('_') ||
                                (k.startsWith('[') && k.endsWith(']')) ||
                                k === DocDockConstants.ReservedKeys.DescriptionUpper ||
                                k === DocDockConstants.ReservedKeys.DescriptionLower
                            ) {
                                newDescObj[k] = (descVal as any)[k];
                            }
                        });
                    }
                    newDescription[sectionName] = newDescObj;
                }
            }
        }

        return {
            ...prunedDoc,
            template: newTemplate,
            description: newDescription
        };
    }
}
