import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SourceProcessor } from './source-processor';
import * as fs from 'fs';
import { Loader } from './loader';
import { FileNotFoundError } from './errors';
import { DocDockConstants } from './constants';
import { ModeStrategy } from '../modes/types';
import { PathUtils } from './path-utils';

vi.mock('fs');
vi.mock('./loader');
vi.mock('./merger');
vi.mock('./alias-processor');

const createMockStrategy = (opts: Partial<ModeStrategy> = {}) =>
    ({
        getSchema: vi.fn(),
        getMergeableKeys: vi.fn().mockReturnValue([]),
        getDuplicateExemptKeys: vi.fn().mockReturnValue([]),
        getCustomizer: undefined,
        ...opts
    }) as unknown as ModeStrategy;

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

    it('should search for guide files when processing single document', () => {
        vi.mocked(fs.existsSync).mockImplementation(
            (filePath) =>
                String(filePath).includes('src.yaml') ||
                String(filePath).includes(DocDockConstants.FileSuffixes.GuideYaml)
        );
        vi.mocked(Loader.loadTemplate).mockReturnValue({});

        // 単一ソースファイル処理の実行
        SourceProcessor.processSingle('src.yaml', createMockStrategy(), mockPageConfig, mockConfigPath, true);

        expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining(DocDockConstants.FileSuffixes.GuideYaml));
    });

    it('should resolve source template path relative to configPath directory', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(Loader.loadTemplate).mockReturnValue({ Key: 'Value' });

        const customConfigPath = 'dir/subdir/config.yaml';
        // 相対パス解決を伴う単一ソースファイル処理の実行
        SourceProcessor.processSingle('src.yaml', createMockStrategy(), mockPageConfig, customConfigPath, true);

        const expectedResolvedPath = require('path').resolve('dir/subdir', 'src.yaml');
        expect(Loader.loadTemplate).toHaveBeenCalledWith(expectedResolvedPath, undefined);
    });

    describe('processSingle', () => {
        it('should process a single source file and return SingleDocument', () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(Loader.loadTemplate).mockReturnValue({
                Description: 'Top level desc',
                tasks: [{ id: '1' }]
            });

            // 単一ソースファイル処理の実行
            const result = SourceProcessor.processSingle(
                'sub/tasks.yaml',
                createMockStrategy(),
                mockPageConfig,
                mockConfigPath,
                true
            );

            expect(result.sourcePath).toBe('sub/tasks.yaml');
            expect(result.sourceBaseName).toBe('tasks');
            expect(result.template.Description).toBe('Top level desc');
        });

        it('should throw FileNotFoundError if file does not exist', () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            // ファイル不在時におけるエラー送出検証
            expect(() => {
                SourceProcessor.processSingle(
                    'nonexistent.yaml',
                    createMockStrategy(),
                    mockPageConfig,
                    mockConfigPath,
                    true
                );
            }).toThrow(FileNotFoundError);
        });
    });

    describe('findDefinitionFile', () => {
        it('should find nested definition file first when sub directory exists', () => {
            const findFileSpy = vi
                .spyOn(PathUtils, 'findFileWithExtensions')
                .mockReturnValueOnce('/guides/sub/service.guide.yml');

            // 階層パス優先探索の実行
            const result = (SourceProcessor as any).findDefinitionFile('sub/service.yaml', '/guides', ['.guide.yml']);

            expect(result).toBe('/guides/sub/service.guide.yml');
            findFileSpy.mockRestore();
        });

        it('should fallback to flat definition file when nested file not found', () => {
            const findFileSpy = vi
                .spyOn(PathUtils, 'findFileWithExtensions')
                .mockReturnValueOnce(null)
                .mockReturnValueOnce('/guides/service.guide.yml');

            // フラットパスフォールバック探索の実行
            const result = (SourceProcessor as any).findDefinitionFile('sub/service.yaml', '/guides', ['.guide.yml']);

            expect(result).toBe('/guides/service.guide.yml');
            findFileSpy.mockRestore();
        });

        it('should find definition file with stripped first directory segment', () => {
            const findFileSpy = vi
                .spyOn(PathUtils, 'findFileWithExtensions')
                .mockReturnValueOnce(null)
                .mockReturnValueOnce('/guides/sub/service.guide.yml');

            // 先頭ディレクトリ除去パスによる探索実行
            const result = (SourceProcessor as any).findDefinitionFile('sources/sub/service.yaml', '/guides', [
                '.guide.yml'
            ]);

            expect(result).toBe('/guides/sub/service.guide.yml');
            findFileSpy.mockRestore();
        });

        it('should retain Description in template of SingleDocument', () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(Loader.loadTemplate).mockReturnValue({
                Description: 'Sample Description Text',
                Resources: {}
            });

            // 単一ドキュメント処理の実行
            const doc = SourceProcessor.processSingle(
                'service.yaml',
                createMockStrategy(),
                mockPageConfig,
                mockConfigPath,
                true
            );

            expect(doc.template.Description).toBe('Sample Description Text');
        });
    });
});
