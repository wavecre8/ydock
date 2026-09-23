import { describe, it, expect } from 'vitest';
import { DocumentIndex } from './document-index';
import { GenericStrategy } from '../modes/generic';

describe('DocumentIndex', () => {
    it('単一ドキュメントからキー階層とセクションマップを構築する', () => {
        const rawDoc = {
            sourcePath: 'tasks.yml',
            sourceBaseName: 'tasks',
            template: {
                Tasks: {
                    TaskA: {
                        Type: 'Simple',
                        Properties: { Timeout: 30 }
                    }
                }
            }
        };
        const parentDoc = {
            template: rawDoc.template,
            mode: 'generic' as const
        };
        const strategy = new GenericStrategy();
        const sortSections = (s: string[]) => s;
        const ignoredSections: string[] = [];

        // ドキュメントインデックス構築処理の実行
        const indexed = DocumentIndex.indexDocument(
            rawDoc,
            0,
            false,
            parentDoc,
            strategy,
            sortSections,
            ignoredSections
        );

        expect(indexed.docIndex).toBe(0);
        expect(indexed.lowerKeySet.has('tasks')).toBe(true);
        expect(indexed.allChildKeys.has('taska')).toBe(true);
        expect(indexed.childToSectionMap.get('taska')).toBe('Tasks');
        expect(indexed.childDirectProps.get('taska')?.has('type')).toBe(true);
        expect(indexed.childNestedProps.get('taska')?.has('timeout')).toBe(true);
    });

    it('トップレベルキーまたは子キーに基づいて合致ドキュメントを探索する', () => {
        const rawDoc = {
            sourcePath: 'service.yml',
            sourceBaseName: 'service',
            template: {
                Services: {
                    WebService: { Port: 80 }
                }
            }
        };
        const parentDoc = { template: rawDoc.template };
        const strategy = new GenericStrategy();
        const indexed = DocumentIndex.indexDocument(rawDoc, 0, false, parentDoc, strategy, (s) => s, []);

        // トップレベルキー探索の実行
        const topMatches = DocumentIndex.findMatchingDocs([indexed], 'services');
        expect(topMatches).toHaveLength(1);

        // 子キー探索の実行
        const childMatches = DocumentIndex.findMatchingDocs([indexed], 'webservice');
        expect(childMatches).toHaveLength(1);

        // 未知キー探索の実行
        const emptyMatches = DocumentIndex.findMatchingDocs([indexed], 'nonexistent');
        expect(emptyMatches).toHaveLength(0);
    });
});
