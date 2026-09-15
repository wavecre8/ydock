import { describe, it, expect } from 'vitest';
import { ConfigUtils } from './config-utils';
import { PageConfig } from '../types';

describe('ConfigUtils', () => {
    describe('createPageRouteMap', () => {
        it('各ページの出力ファイル名およびソース識別子から相対パスをマッピングする', () => {
            const page1: PageConfig = {
                title: 'メインスタック',
                sources: ['sources/cfn_main.yml'],
                output: 'output/cfn-main.html'
            };
            const page2: PageConfig = {
                title: 'サブスタック',
                sources: ['sources/cfn_part.yml'],
                output: 'output/cfn-part.html'
            };

            const allPages = [page1, page2];
            const routeMap = ConfigUtils.createPageRouteMap(page1, allPages);

            // ソースのベース名による逆引き
            expect(routeMap.get('cfn_part')).toBe('cfn-part.html');
            // ソースのファイル名による逆引き
            expect(routeMap.get('cfn_part.yml')).toBe('cfn-part.html');
            // ソースの相対パスによる逆引き
            expect(routeMap.get('sources/cfn_part.yml')).toBe('cfn-part.html');
            // 出力ファイル名による逆引き
            expect(routeMap.get('cfn-part.html')).toBe('cfn-part.html');
            expect(routeMap.get('cfn-part')).toBe('cfn-part.html');
        });

        it('異なる階層の出力ディレクトリに対しても正確な相対パスを導出する', () => {
            const page1: PageConfig = {
                title: 'メイン',
                sources: ['sources/main.yml'],
                output: 'output/sub/main.html'
            };
            const page2: PageConfig = {
                title: '別ページ',
                sources: ['sources/other.yml'],
                output: 'output/other.html'
            };

            const routeMap = ConfigUtils.createPageRouteMap(page1, [page1, page2]);
            expect(routeMap.get('other')).toBe('../other.html');
        });
    });
});
