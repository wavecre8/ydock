import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Generator } from './generator';
import * as fs from 'fs';
import * as ejs from 'ejs';
import { ModeStrategy } from '../modes/types';

vi.mock('fs');
vi.mock('ejs');

const mockStrategy = {
    getIgnoredSections: vi.fn().mockReturnValue([]),
    getSectionSortOrder: vi.fn().mockReturnValue(undefined),
    isIntrinsic: vi.fn().mockReturnValue(false),
} as unknown as ModeStrategy;

describe('Generator', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should generate HTML with injected CSS and JS', () => {

        vi.mocked(fs.readFileSync).mockImplementation((path) => {
            if (String(path).endsWith('style.css')) return 'BODY { color: red; }';
            if (String(path).endsWith('script.js')) return 'console.log("hi");';
            return '<html>/* INJECT_CSS_PLACEHOLDER */// INJECT_JS_PLACEHOLDER</html>';
        });
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(ejs.render).mockReturnValue('<html>/* INJECT_CSS_PLACEHOLDER */// INJECT_JS_PLACEHOLDER</html>');

        const doc = { template: {}, description: {}, mode: 'generic' as const };
        
        const html = Generator.generate(
            doc,
            'template.ejs',
            mockStrategy
        );

        expect(html).toContain('BODY { color: red; }');
        expect(html).toContain('console.log("hi");');
        expect(html).not.toContain('INJECT_CSS_PLACEHOLDER');
    });

    it('should preserve dollar sign patterns in injected CSS and JS without regex replacement distortion', () => {
        vi.mocked(fs.readFileSync).mockImplementation((path) => {
            if (String(path).endsWith('style.css')) return '.rule { content: "$& $$ $\'"; }';
            if (String(path).endsWith('script.js')) return 'const q = $("div"); const ref = "$` $1";';
            return '<html>/* INJECT_CSS_PLACEHOLDER */// INJECT_JS_PLACEHOLDER</html>';
        });
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(ejs.render).mockReturnValue('<html>/* INJECT_CSS_PLACEHOLDER */// INJECT_JS_PLACEHOLDER</html>');

        const doc = { template: {}, description: {}, mode: 'generic' as const };
        
        // 特殊置換記号を含むアセット埋め込みの実行
        const html = Generator.generate(
            doc,
            'template.ejs',
            mockStrategy
        );

        // 特殊文字パターンの保持検証
        expect(html).toContain('.rule { content: "$& $$ $\'"; }');
        expect(html).toContain('const q = $("div"); const ref = "$` $1";');
    });

    it('should handle missing CSS/JS gracefully', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('<html>/* INJECT_CSS_PLACEHOLDER */</html>');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('<html>/* INJECT_CSS_PLACEHOLDER */</html>');

        const doc = { template: {}, description: {}, mode: 'generic' as const };
        
        const html = Generator.generate(
            doc,
            'template.ejs',
            mockStrategy
        );

        expect(html).toContain('INJECT_CSS_PLACEHOLDER');
    });

    it('should sort sections if order provided', () => {
        vi.mocked(fs.readFileSync).mockReturnValue('');
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(ejs.render).mockReturnValue('');

        const localStrategy = {
           ...mockStrategy,
           getIgnoredSections: vi.fn().mockReturnValue([]),
           getSectionSortOrder: vi.fn().mockReturnValue(['First', 'Second']) 
        } as unknown as ModeStrategy;

        const doc = { 
            template: { Second: {}, First: {} }, 
            description: {}, 
            mode: 'generic' as const 
        };

        Generator.generate(doc, 't.ejs', localStrategy);

        const ejsCall = vi.mocked(ejs.render).mock.calls[0];
        const data = ejsCall[1] as any;
        expect(data.renderableSections).toEqual(['First', 'Second']);
    });
});
