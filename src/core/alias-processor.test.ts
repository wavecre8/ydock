import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AliasProcessor } from './alias-processor';
import * as fs from 'fs';



vi.mock('fs', async () => {
    return {
        ...(await vi.importActual('fs')),
        existsSync: vi.fn(),
        readFileSync: vi.fn()
    };
});

describe('AliasProcessor', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should return empty object if file does not exist', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);
        const result = AliasProcessor.loadAndProcess('nonexistent.yml', {});
        expect(result).toEqual({});
    });

    it('should load and transform leaf strings to aliases', () => {
        const yamlContent = `
key1: "Alias 1"
key2:
  nested: "Alias Nested"
`;
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(yamlContent);

        const result = AliasProcessor.loadAndProcess('alias.yml', {});

        expect(result).toEqual({
            key1: { _alias: 'Alias 1' },
            key2: {
                nested: { _alias: 'Alias Nested' }
            }
        });
    });

    it('should preserve keys starting with underscore (metadata)', () => {
        const yamlContent = `
key1:
  _alias: "Explicit Alias"
  _hidden: true
`;
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(yamlContent);

        const result = AliasProcessor.loadAndProcess('alias.yml', {});

        expect(result).toEqual({
            key1: {
                _alias: 'Explicit Alias',
                _hidden: true
            }
        });
    });

    it('should expand wildcards based on source array length', () => {
        const yamlContent = `
items:
  "*":
    name: "Item Name"
`;
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(yamlContent);

        const sourceTemplate = {
            items: [{ id: 1 }, { id: 2 }, { id: 3 }]
        };

        const result = AliasProcessor.loadAndProcess('alias.yml', sourceTemplate);


        expect(result).toEqual({
            items: {
                '0': { name: { _alias: 'Item Name' } },
                '1': { name: { _alias: 'Item Name' } },
                '2': { name: { _alias: 'Item Name' } }
            }
        });
    });

    it('should handle nested wildcards', () => {
        const yamlContent = `
items:
  "*":
    subItems:
      "*": "Sub Name"
`;
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(yamlContent);

        const sourceTemplate = {
            items: [{ subItems: ['a', 'b'] }]
        };

        const result = AliasProcessor.loadAndProcess('alias.yml', sourceTemplate);


        expect(result).toEqual({
            items: {
                '0': {
                    subItems: {
                        '0': { _alias: 'Sub Name' },
                        '1': { _alias: 'Sub Name' }
                    }
                }
            }
        });
    });
});
