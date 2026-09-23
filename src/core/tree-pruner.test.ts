import { describe, it, expect } from 'vitest';
import { TreePruner } from './tree-pruner';
import { ConditionMatcher } from './condition-matcher';
import { GenericStrategy } from '../modes/generic';

describe('TreePruner', () => {
    it('除外ツリーに基づいて指定されたノードを刈り取る', () => {
        const doc = {
            template: {
                connectivityAt: '2024-01-01',
                containers: [
                    {
                        name: 'web',
                        image: 'nginx',
                        networkInterfaces: [{ attachmentId: '123' }]
                    }
                ],
                otherProp: 'value'
            },
            excludeTree: {
                connectivityAt: true,
                containers: {
                    __value: true,
                    '[]': {
                        name: { __value: false }
                    }
                }
            }
        };
        const matcher = new ConditionMatcher(new GenericStrategy(), doc);
        // 除外ツリー適用処理の実行
        const result = TreePruner.prune(doc, matcher);

        expect(result.template.connectivityAt).toBeUndefined();
        expect(result.template.otherProp).toBe('value');
        const containers = result.template.containers as any[];
        expect(containers[0].name).toBe('web');
        expect(containers[0].image).toBeUndefined();
        expect(containers[0].networkInterfaces).toBeUndefined();
    });

    it('templateまたはexcludeTreeが存在しない場合はそのままドキュメントを返却する', () => {
        const emptyDoc = { template: undefined as any };
        const matcher = new ConditionMatcher(new GenericStrategy(), emptyDoc);
        // 空ドキュメントに対する除外処理の実行
        const result = TreePruner.prune(emptyDoc, matcher);
        expect(result).toEqual(emptyDoc);
    });

    it('ワイルドカード指定による一括除外と特定キー保持を正しく処理する', () => {
        const doc = {
            template: {
                server: {
                    host: 'localhost',
                    port: 8080,
                    debug: true,
                    secretKey: 'xyz'
                }
            },
            excludeTree: {
                server: {
                    '*': true,
                    host: false
                }
            }
        };
        const matcher = new ConditionMatcher(new GenericStrategy(), doc);
        // ワイルドカード除外ツリー適用処理の実行
        const result = TreePruner.prune(doc, matcher);

        expect(result.template.server).toBeDefined();
        const server = result.template.server as Record<string, unknown>;
        expect(server.host).toBe('localhost');
        expect(server.port).toBeUndefined();
        expect(server.debug).toBeUndefined();
        expect(server.secretKey).toBeUndefined();
    });
});
