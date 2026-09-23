import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportResolver } from './import-resolver';
import { Loader } from './loader';
import * as fs from 'fs';
import { DocDockConstants } from './constants';
import { CircularImportError, InvalidImportError } from './errors';

vi.mock('fs', async () => {
    return {
        ...(await vi.importActual('fs')),
        existsSync: vi.fn()
    };
});

vi.mock('./loader', () => {
    return {
        Loader: {
            loadTemplate: vi.fn()
        }
    };
});

describe('ImportResolver', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should return original data if no _imports are present', () => {
        const data = { key: 'value' };
        const result = ImportResolver.resolve(data, '/base');
        expect(result).toEqual(data);
    });

    it('should resolve and merge imports recursively', () => {
        const data = {
            [DocDockConstants.ReservedKeys.Imports]: ['common.yml'],
            key: 'override'
        };

        const commonData = {
            key: 'base',
            commonKey: 'commonValue'
        };

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(Loader.loadTemplate).mockReturnValue(commonData);

        const result = ImportResolver.resolve(data, '/base');

        expect(result).toEqual({
            key: 'override',
            commonKey: 'commonValue'
        });
        expect(Loader.loadTemplate).toHaveBeenCalledWith(expect.stringContaining('common.yml'), undefined);
    });

    it('should merge array elements using condition matching instead of index overwrite', () => {
        const data = {
            [DocDockConstants.ReservedKeys.Imports]: ['common.yml'],
            tags: [
                {
                    '=Key': 'Environment',
                    Value: '本番環境'
                }
            ]
        };

        const commonData = {
            tags: [
                {
                    '=Key': 'Environment',
                    Key: '環境識別キー',
                    Value: '共通デフォルト環境'
                },
                {
                    '=Key': 'Project',
                    Key: 'プロジェクト名',
                    Value: '共通プロジェクト'
                }
            ]
        };

        // モック定義の設定
        vi.mocked(fs.existsSync).mockReturnValue(true);
        // テンプレート読み込みモックの戻り値設定
        vi.mocked(Loader.loadTemplate).mockReturnValue(commonData);

        // インポート解決処理の実行
        const result = ImportResolver.resolve(data, '/base') as any;

        expect(result.tags).toHaveLength(2);
        expect(result.tags[0]).toEqual({
            '=Key': 'Environment',
            Key: '環境識別キー',
            Value: '本番環境'
        });
        expect(result.tags[1]).toEqual({
            '=Key': 'Project',
            Key: 'プロジェクト名',
            Value: '共通プロジェクト'
        });
    });

    it('should throw CircularImportError when circular import is detected', () => {
        const fileA = {
            [DocDockConstants.ReservedKeys.Imports]: ['b.yml'],
            key: 'valA'
        };
        const fileB = {
            [DocDockConstants.ReservedKeys.Imports]: ['a.yml'],
            key: 'valB'
        };

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(Loader.loadTemplate).mockImplementation((filePath: string) => {
            if (filePath.endsWith('b.yml')) return fileB;
            if (filePath.endsWith('a.yml')) return fileA;
            return {};
        });

        // 循環インポート発生時の例外送出検証
        expect(() => ImportResolver.resolve(fileA, '/base')).toThrow(CircularImportError);
    });

    it('should throw InvalidImportError when import element is not a string', () => {
        const data = {
            [DocDockConstants.ReservedKeys.Imports]: [null as any],
            key: 'val'
        };

        // 不正なインポート要素指定時の例外送出検証
        expect(() => ImportResolver.resolve(data, '/base')).toThrow(InvalidImportError);
    });
});
