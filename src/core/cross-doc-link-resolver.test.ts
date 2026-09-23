import { describe, it, expect } from 'vitest';
import { CrossDocLinkResolver } from './cross-doc-link-resolver';
import { DocumentIndex } from './document-index';
import { GenericStrategy } from '../modes/generic';

describe('CrossDocLinkResolver', () => {
    it('単一ドキュメント時はプレフィックスなしで短縮セグメントを展開補完して返却する', () => {
        const rawDoc = {
            sourcePath: 'doc.yml',
            sourceBaseName: 'doc',
            template: { Items: { Item1: 'val' } }
        };
        const strategy = new GenericStrategy();
        const indexed = DocumentIndex.indexDocument(
            rawDoc,
            0,
            false,
            { template: rawDoc.template },
            strategy,
            (s) => s,
            []
        );
        const resolver = new CrossDocLinkResolver([indexed], false, strategy);

        // リンク解決詳細情報の取得
        const detail = resolver.resolveLinkDetail('Item1', indexed);
        expect(detail.prefix).toBeUndefined();
        expect(detail.segments).toEqual(['Items', 'Item1']);
    });

    it('複数ドキュメント時に該当ドキュメントのプレフィックスを解決する', () => {
        const rawDoc1 = {
            sourcePath: 'doc1.yml',
            sourceBaseName: 'doc1',
            template: { Users: { Alice: 'admin' } }
        };
        const rawDoc2 = {
            sourcePath: 'doc2.yml',
            sourceBaseName: 'doc2',
            template: { Roles: { Viewer: 'read' } }
        };
        const strategy = new GenericStrategy();
        const indexed1 = DocumentIndex.indexDocument(
            rawDoc1,
            0,
            true,
            { template: rawDoc1.template },
            strategy,
            (s) => s,
            []
        );
        const indexed2 = DocumentIndex.indexDocument(
            rawDoc2,
            1,
            true,
            { template: rawDoc2.template },
            strategy,
            (s) => s,
            []
        );

        const resolver = new CrossDocLinkResolver([indexed1, indexed2], true, strategy);

        // 別ドキュメント配下要素のリンク解決実行
        const detail = resolver.resolveLinkDetail('Roles', indexed1);
        expect(detail.prefix).toBe('doc_1');
        expect(detail.segments).toEqual(['Roles']);
    });

    it('明示的なスコープ指定に基づいて特定ドキュメントへリンクを解決する', () => {
        const rawDoc1 = {
            sourcePath: 'a.yml',
            sourceBaseName: 'a',
            template: { Config: { Host: 'local' } }
        };
        const rawDoc2 = {
            sourcePath: 'b.yml',
            sourceBaseName: 'b',
            template: { Config: { Host: 'remote' } }
        };
        const strategy = new GenericStrategy();
        const indexed1 = DocumentIndex.indexDocument(
            rawDoc1,
            0,
            true,
            { template: rawDoc1.template },
            strategy,
            (s) => s,
            []
        );
        const indexed2 = DocumentIndex.indexDocument(
            rawDoc2,
            1,
            true,
            { template: rawDoc2.template },
            strategy,
            (s) => s,
            []
        );

        const resolver = new CrossDocLinkResolver([indexed1, indexed2], true, strategy);

        // スコープ明示指定によるリンク解決実行
        const detail = resolver.resolveLinkDetail('Config', indexed1, 'b');
        expect(detail.prefix).toBe('doc_1');
    });

    it('カレントページ外の明示的スコープ指定に対してtargetPageを導出する', () => {
        const rawDoc1 = {
            sourcePath: 'cfn_main.yml',
            sourceBaseName: 'cfn_main',
            template: { Parameters: { EnvType: 'prod' } }
        };
        const strategy = new GenericStrategy();
        const indexed1 = DocumentIndex.indexDocument(
            rawDoc1,
            0,
            false,
            { template: rawDoc1.template },
            strategy,
            (s) => s,
            []
        );
        const resolver = new CrossDocLinkResolver([indexed1], false, strategy);

        const detail = resolver.resolveLinkDetail('Rules.ProdCheck', indexed1, 'cfn_part');
        expect(detail.targetPage).toBe('cfn_part.html');
        expect(detail.segments).toEqual(['Rules', 'ProdCheck']);
    });

    it('pageRouteMapが存在する場合はマップされた実際のHTMLファイル名をtargetPageとして解決する', () => {
        const rawDoc1 = {
            sourcePath: 'cfn_main.yml',
            sourceBaseName: 'cfn_main',
            template: { Parameters: { EnvType: 'prod' } }
        };
        const strategy = new GenericStrategy();
        const indexed1 = DocumentIndex.indexDocument(
            rawDoc1,
            0,
            false,
            { template: rawDoc1.template },
            strategy,
            (s) => s,
            []
        );
        const pageRouteMap = new Map<string, string>();
        pageRouteMap.set('cfn_part', 'cfn-part.html');

        const resolver = new CrossDocLinkResolver([indexed1], false, strategy, pageRouteMap);

        const detail = resolver.resolveLinkDetail('Rules.ProdCheck', indexed1, 'cfn_part');
        expect(detail.targetPage).toBe('cfn-part.html');
        expect(detail.segments).toEqual(['Rules', 'ProdCheck']);
    });

    it('マルチドキュメント構成であってもpageRouteMapに一致すれば外部ページへのリンクとして解決する', () => {
        const rawDoc1 = {
            sourcePath: 'doc1.yml',
            sourceBaseName: 'doc1',
            template: { Items: { A: '1' } }
        };
        const rawDoc2 = {
            sourcePath: 'doc2.yml',
            sourceBaseName: 'doc2',
            template: { Items: { B: '2' } }
        };
        const strategy = new GenericStrategy();
        const indexed1 = DocumentIndex.indexDocument(
            rawDoc1,
            0,
            true,
            { template: rawDoc1.template },
            strategy,
            (s) => s,
            []
        );
        const indexed2 = DocumentIndex.indexDocument(
            rawDoc2,
            1,
            true,
            { template: rawDoc2.template },
            strategy,
            (s) => s,
            []
        );
        const pageRouteMap = new Map<string, string>();
        pageRouteMap.set('external_doc', 'other-page.html');

        const resolver = new CrossDocLinkResolver([indexed1, indexed2], true, strategy, pageRouteMap);

        const detail = resolver.resolveLinkDetail('Config.Key', indexed1, 'external_doc');
        expect(detail.targetPage).toBe('other-page.html');
        expect(detail.segments).toEqual(['Config', 'Key']);
    });

    it('マルチドキュメント構成であっても明示的にhtml拡張子が指定された場合は外部ページへのリンクとして解決する', () => {
        const rawDoc1 = {
            sourcePath: 'doc1.yml',
            sourceBaseName: 'doc1',
            template: { Items: { A: '1' } }
        };
        const rawDoc2 = {
            sourcePath: 'doc2.yml',
            sourceBaseName: 'doc2',
            template: { Items: { B: '2' } }
        };
        const strategy = new GenericStrategy();
        const indexed1 = DocumentIndex.indexDocument(
            rawDoc1,
            0,
            true,
            { template: rawDoc1.template },
            strategy,
            (s) => s,
            []
        );
        const indexed2 = DocumentIndex.indexDocument(
            rawDoc2,
            1,
            true,
            { template: rawDoc2.template },
            strategy,
            (s) => s,
            []
        );

        const resolver = new CrossDocLinkResolver([indexed1, indexed2], true, strategy);

        const detail = resolver.resolveLinkDetail('Config.Key', indexed1, 'target.html');
        expect(detail.targetPage).toBe('target.html');
        expect(detail.segments).toEqual(['Config', 'Key']);
    });
});
