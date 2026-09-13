import { describe, it, expect, vi } from 'vitest';
import { Loader } from './loader';
import * as fs from 'fs';

vi.mock('fs');

describe('Loader', () => {
    describe('loadConfig', () => {
        it('should load YAML config', () => {
            const yamlContent = 'title: MyConfig\npages: []';
            vi.mocked(fs.readFileSync).mockReturnValue(yamlContent);
            
            const config = Loader.loadConfig('config.yaml');
            expect(config).toEqual({ title: 'MyConfig', pages: [] });
        });
    });

    describe('loadTemplate', () => {
        it('should load YAML template', () => {
            const yamlContent = 'Key: Value';
            vi.mocked(fs.readFileSync).mockReturnValue(yamlContent);
            
            const template = Loader.loadTemplate('template.yaml');
            expect(template).toEqual({ Key: 'Value' });
        });

        it('should load JSON template', () => {
            const jsonContent = '{"Key": "Value"}';
            vi.mocked(fs.readFileSync).mockReturnValue(jsonContent);

            const template = Loader.loadTemplate('template.json');
            expect(template).toEqual({ Key: 'Value' });
        });

        it('should return empty object when YAML content is empty', () => {
            vi.mocked(fs.readFileSync).mockReturnValue('');
            // 空YAMLファイル読み込み時のフォールバック検証
            const template = Loader.loadTemplate('empty.yaml');
            expect(template).toEqual({});
        });

        it('should return empty object when JSON content is empty', () => {
            vi.mocked(fs.readFileSync).mockReturnValue('   ');
            // 空JSONファイル読み込み時のフォールバック検証
            const template = Loader.loadTemplate('empty.json');
            expect(template).toEqual({});
        });

        it('should return empty object when config content is empty', () => {
            vi.mocked(fs.readFileSync).mockReturnValue('');
            // 空設定ファイル読み込み時のフォールバック検証
            const config = Loader.loadConfig('empty.config.yml');
            expect(config).toEqual({});
        });

        // The default throw behavior of fs.readFileSync is fine,
        // we mostly want to check if it propagates.
        it('should propagate fs errors', () => {
            vi.mocked(fs.readFileSync).mockImplementation(() => {
                throw new Error('File not found');
            });

            expect(() => Loader.loadTemplate('missing.yaml')).toThrow('File not found');
        });
    });
});
