import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SourceProcessor } from './source-processor';
import * as fs from 'fs';
import { Loader } from './loader';
import { Merger } from './merger';

import { FileNotFoundError, DuplicateKeyError } from './errors';
import { DocDockConstants } from './constants';
import { ModeStrategy } from '../modes/types';

vi.mock('fs');
vi.mock('./loader');
vi.mock('./merger');
vi.mock('./alias-processor');

const createMockStrategy = (opts: Partial<ModeStrategy> = {}) => ({
    getSchema: vi.fn(),
    getMergeableKeys: vi.fn().mockReturnValue([]),
    getDuplicateExemptKeys: vi.fn().mockReturnValue([]),
    getCustomizer: undefined,
    ...opts
} as unknown as ModeStrategy);

describe('SourceProcessor', () => {
    const mockPageConfig = {
        title: 'Test Page',
        description: 'Test Desc',
        output: 'out.html',
        templates: ['src.yaml'],
        sources: ['src.yaml'],
        guideDir: 'guides',
        aliasDir: 'aliases'
    };
    const mockConfigPath = 'config.yaml';

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should throw FileNotFoundError if source file does not exist', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        expect(() => {
            SourceProcessor.process(
                'missing.yaml',
                createMockStrategy(),
                mockPageConfig,
                mockConfigPath,
                new Set(),
                [],
                {},
                {},
                true
            );
        }).toThrow(FileNotFoundError);
    });

    it('should load source template and merge it', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(Loader.loadTemplate).mockReturnValue({ Key: 'Value' });
        vi.mocked(Merger.mergeDescriptions).mockReturnValue({ Merged: 'Data' });

        const result = SourceProcessor.process(
            'src.yaml',
            createMockStrategy(),
            mockPageConfig,
            mockConfigPath,
            new Set(),
            [],
            {},
            {},
            true
        );

        const expectedPath = require('path').resolve('src.yaml');
        expect(Loader.loadTemplate).toHaveBeenCalledWith(expectedPath, undefined);
        expect(result.template).toEqual({ Merged: 'Data' });
    });

    it('should throw DuplicateKeyError if duplicates found and no customizer', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(Loader.loadTemplate).mockReturnValue({ Key1: 'Value' });
        
        const strategy = createMockStrategy({ getCustomizer: undefined });
        const seenKeys = new Set(['Key1']);

        expect(() => {
            SourceProcessor.process(
                'src.yaml',
                strategy,
                mockPageConfig,
                mockConfigPath,
                seenKeys,
                [],
                {},
                {},
                true
            );
        }).toThrow(DuplicateKeyError);
    });

    it('should NOT throw DuplicateKeyError if key is exempt', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(Loader.loadTemplate).mockReturnValue({ ExemptKey: 'Value' });

        const strategy = createMockStrategy({ 
            getDuplicateExemptKeys: vi.fn().mockReturnValue(['ExemptKey']) 
        });
        const seenKeys = new Set(['ExemptKey']);

        SourceProcessor.process(
            'src.yaml',
            strategy,
            mockPageConfig,
            mockConfigPath,
            seenKeys,
            [],
            {},
            {},
            true
        );
    });

    it('should search for guide files', () => {
         vi.mocked(fs.existsSync).mockImplementation((path) => String(path).includes('src.yaml') || String(path).includes(DocDockConstants.FileSuffixes.GuideYaml));
         vi.mocked(Loader.loadTemplate).mockReturnValue({});

         SourceProcessor.process(
            'src.yaml',
            createMockStrategy(),
            mockPageConfig,
            mockConfigPath,
            new Set(),
            [],
            {},
            {},
            true
        );

        expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining(DocDockConstants.FileSuffixes.GuideYaml));
    });

    it('should resolve source template path relative to configPath directory', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(Loader.loadTemplate).mockReturnValue({ Key: 'Value' });
        vi.mocked(Merger.mergeDescriptions).mockReturnValue({ Merged: 'Data' });

        const customConfigPath = 'dir/subdir/config.yaml';
        SourceProcessor.process(
            'src.yaml',
            createMockStrategy(),
            mockPageConfig,
            customConfigPath,
            new Set(),
            [],
            {},
            {},
            true
        );

        const expectedResolvedPath = require('path').resolve('dir/subdir', 'src.yaml');
        expect(Loader.loadTemplate).toHaveBeenCalledWith(expectedResolvedPath, undefined);
    });

    describe('aliasCustomizer', () => {
        it('should return undefined if parameters do not match array-object collision', () => {
            const result = (SourceProcessor as any).aliasCustomizer('string', 'string');
            expect(result).toBeUndefined();
        });

        it('should call Merger.mergeAliasObjectWithArray when objValue is Array and srcValue is Object', () => {
            const mergeSpy = vi.spyOn(Merger, 'mergeAliasObjectWithArray').mockReturnValue({ merged: true });
            
            const objValue = [{ '=name': 'test' }];
            const srcValue = { _alias: 'TestAlias' };
            
            const result = (SourceProcessor as any).aliasCustomizer(objValue, srcValue);
            
            expect(mergeSpy).toHaveBeenCalledWith(srcValue, objValue, (SourceProcessor as any).aliasCustomizer);
            expect(result).toEqual({ merged: true });
        });
    });
});
