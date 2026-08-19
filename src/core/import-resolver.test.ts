import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportResolver } from './import-resolver';
import { Loader } from './loader';
import * as fs from 'fs';
import { DocDockConstants } from './constants';

vi.mock('fs', async () => {
    return {
        ...(await vi.importActual('fs')),
        existsSync: vi.fn(),
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
});
