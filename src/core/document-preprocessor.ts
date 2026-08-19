import { DocDockDocument } from '../types';
import { ConditionMatcher } from './condition-matcher';
import { DocDockConstants } from './constants';

export class DocumentPreprocessor {
    static process(doc: DocDockDocument, matcher: ConditionMatcher): DocDockDocument {
        if (!doc.template) return doc;

        const prunedDoc = this.applyExcludes(doc, matcher);
        const newTemplate = { ...prunedDoc.template };
        const newDescription = prunedDoc.description ? { ...prunedDoc.description } : undefined;

        for (const sectionName of Object.keys(newTemplate)) {
            const templateVal = newTemplate[sectionName];
            const descVal = newDescription ? newDescription[sectionName] : undefined;

            if (Array.isArray(templateVal)) {
                const newTemplateObj: Record<string, any> = {};
                const newDescObj: Record<string, any> = {};

                templateVal.forEach((item, index) => {
                    const itemDesc = matcher.findMatchingGuide(item, descVal, index);
                    const segment = matcher.getMatchingConditionSegment(item, descVal) || String(index);

                    newTemplateObj[segment] = item;
                    if (newDescription && itemDesc !== undefined) {
                        newDescObj[segment] = itemDesc;
                    }
                });

                newTemplate[sectionName] = newTemplateObj;
                if (newDescription) {
                    if (typeof descVal === 'object' && descVal !== null) {
                        Object.keys(descVal).forEach((k) => {
                            if (k.startsWith('_')) {
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

    private static applyExcludes(doc: DocDockDocument, matcher: ConditionMatcher): DocDockDocument {
        if (!doc.template || !doc.excludeTree) return doc;

        const newTemplate = this.pruneNode(doc.template, doc.excludeTree, matcher);

        return {
            ...doc,
            template: newTemplate === undefined ? {} : newTemplate
        };
    }

    private static hasFalseDescendant(excludeNode: any): boolean {
        if (excludeNode === false) return true;
        if (!excludeNode || typeof excludeNode !== 'object') return false;
        if (excludeNode[DocDockConstants.ReservedKeys.ExcludeValue] === false) return true;
        
        for (const key of Object.keys(excludeNode)) {
            if (key === DocDockConstants.ReservedKeys.ExcludeValue) continue;
            if (Array.isArray(excludeNode[key])) {
                for (const item of excludeNode[key]) {
                    if (this.hasFalseDescendant(item)) return true;
                }
            } else {
                if (this.hasFalseDescendant(excludeNode[key])) return true;
            }
        }
        return false;
    }

    private static pruneNode(data: any, excludeNode: any, matcher: ConditionMatcher): any {
        if (data === undefined) return undefined;

        const isExcludeTrue = typeof excludeNode === 'boolean' ? excludeNode : (excludeNode && excludeNode[DocDockConstants.ReservedKeys.ExcludeValue] === true);
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
            const newArray: any[] = [];
            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                let itemExclude = matcher.findMatchingGuide(item, excludeNode, i) as any;
                
                if (isExcludeTrue) {
                    if (itemExclude === undefined) {
                        itemExclude = true;
                    } else if (typeof itemExclude === 'object' && itemExclude[DocDockConstants.ReservedKeys.ExcludeValue] === undefined) {
                        itemExclude = { ...itemExclude, [DocDockConstants.ReservedKeys.ExcludeValue]: true };
                    }
                }

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

        const newObj: Record<string, any> = {};
        for (const [key, value] of Object.entries(data)) {
            let childExclude = excludeNode ? excludeNode[key] : undefined;
            
            if (isExcludeTrue) {
                if (childExclude === undefined) {
                    childExclude = true;
                } else if (typeof childExclude === 'object' && childExclude[DocDockConstants.ReservedKeys.ExcludeValue] === undefined) {
                    childExclude = { ...childExclude, [DocDockConstants.ReservedKeys.ExcludeValue]: true };
                }
            }

            const prunedValue = this.pruneNode(value, childExclude, matcher);
            if (prunedValue !== undefined) {
                newObj[key] = prunedValue;
            }
        }
        
        const originalKeys = Object.keys(data);
        if (originalKeys.length > 0 && Object.keys(newObj).length === 0) {
            return undefined;
        }
        return newObj;
    }
}
