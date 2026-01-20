import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateRenderer } from './renderer';
import { ModeStrategy } from '../modes/types';

const mockStrategy = {
    isIntrinsic: vi.fn(),
    getSchema: vi.fn(),
    getMergeableKeys: vi.fn(),
    getSectionSortOrder: vi.fn(),
    getIgnoredSections: vi.fn(),
    getAttributes: vi.fn(),
    getCustomizer: vi.fn(),
    getSectionRenderType: vi.fn(),
    getDuplicateExemptKeys: vi.fn(),
    getResourceComponents: vi.fn()
} as unknown as ModeStrategy;

describe('TemplateRenderer', () => {
    let renderer: TemplateRenderer;

    beforeEach(() => {
        vi.resetAllMocks();
        renderer = new TemplateRenderer(mockStrategy);
    });

    describe('extractMetadata', () => {
        it('should extract description', () => {
            const result = renderer.extractMetadata('My Desc');
            expect(result).toEqual({ description: 'My Desc', alias: undefined, hidden: false });
        });

        it('should extract from object with Description key', () => {
            const result = renderer.extractMetadata({ Description: 'Obj Desc' });
            expect(result).toEqual({ description: 'Obj Desc', alias: undefined, hidden: false });
        });

        it('should extract alias', () => {
            const result = renderer.extractMetadata({ _alias: 'My Alias' });
            expect(result).toEqual({ description: undefined, alias: 'My Alias', hidden: false });
        });

        it('should extract hidden flag', () => {
             const result = renderer.extractMetadata({ _hidden: true });
             expect(result).toEqual({ description: undefined, alias: undefined, hidden: true });
        });
    });

    describe('renderFlow (primitive)', () => {
        it('should render string', () => {
            const html = renderer.renderFlow('hello');
            expect(html).toMatchSnapshot();
        });

        it('should render number', () => {
             const html = renderer.renderFlow(123);
             expect(html).toMatchSnapshot();
        });
    });

    describe('renderFlow (array)', () => {
        it('should render array items', () => {
             const html = renderer.renderFlow([1, 2]);
             expect(html).toMatchSnapshot();
        });
    });

    describe('renderValue (Table)', () => {
        it('should render object as table', () => {
            const val = { key1: 'value1' };
            const html = renderer.renderValue(val, undefined, 'root');
            expect(html).toMatchSnapshot();
        });

        it('should hide hidden keys', () => {
             const val = { key1: 'value1' };
             const desc = { key1: { _hidden: true } };
             const html = renderer.renderValue(val, desc, 'root');
             expect(html).toMatchSnapshot();
        });
    });

    describe('renderIntrinsic', () => {
        it('should render intrinsic function', () => {
             vi.mocked(mockStrategy.isIntrinsic).mockReturnValue(true);
             const val = { '!Ref': 'MyResource' };
             
             const html = renderer.renderValue(val, undefined, 'path');
             
             expect(html).toMatchSnapshot();
        });
    });
});
