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
