import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AliasProcessor } from './alias-processor';
import * as fs from 'fs';
import { DocDockConstants } from './constants';



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
            key1: { [DocDockConstants.ReservedKeys.Alias]: 'Alias 1' },
            key2: {
                nested: { [DocDockConstants.ReservedKeys.Alias]: 'Alias Nested' }
            }
        });
    });

    it('should preserve keys starting with underscore (metadata)', () => {
        const yamlContent = `
key1:
  _alias: "Explicit Alias"
  _description: "Some desc"
`;
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(yamlContent);

        const result = AliasProcessor.loadAndProcess('alias.yml', {});

        expect(result).toEqual({
            key1: {
                [DocDockConstants.ReservedKeys.Alias]: 'Explicit Alias',
                '_description': 'Some desc'
            }
        });
    });

    it('should parse flat path keys into tree structure', () => {
        const yamlContent = `
"items[].name": "Item Name"
"items[=id:1].alias": "Alias 1"
`;
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(yamlContent);

        const result = AliasProcessor.loadAndProcess('alias.yml', {});

        expect(result).toEqual({
            items: {
                [DocDockConstants.ReservedKeys.Array]: { name: { [DocDockConstants.ReservedKeys.Alias]: 'Item Name' } },
                [DocDockConstants.ReservedKeys.Match]: [
                    { '=id': '1', alias: { [DocDockConstants.ReservedKeys.Alias]: 'Alias 1' } }
                ]
            }
        });
    });

    it('should handle complex mixed flat and nested keys', () => {
        const yamlContent = `
items:
  _alias: "Items Array"
"items[].subItems[].name": "Sub Name"
`;
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(yamlContent);

        const result = AliasProcessor.loadAndProcess('alias.yml', {});

        expect(result).toEqual({
            items: {
                [DocDockConstants.ReservedKeys.Alias]: "Items Array",
                [DocDockConstants.ReservedKeys.Array]: {
                    subItems: {
                        [DocDockConstants.ReservedKeys.Array]: { name: { [DocDockConstants.ReservedKeys.Alias]: 'Sub Name' } }
                    }
                }
            }
        });
    });

    it('should parse flat primitive condition match path keys', () => {
        const yamlContent = `
"Transform[=AWS::LanguageExtensions]": "Language Extensions"
`;
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(yamlContent);

        const result = AliasProcessor.loadAndProcess('alias.yml', {});

        expect(result).toEqual({
            Transform: {
                [DocDockConstants.ReservedKeys.Match]: [
                    { '=AWS::LanguageExtensions': { [DocDockConstants.ReservedKeys.Alias]: 'Language Extensions' } }
                ]
            }
        });
    });
});
