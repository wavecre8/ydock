import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { merge } from 'lodash';
import { FileNotFoundError } from './errors';
import { GuideData, TemplateData, YamlValue } from '../types';

export class AliasProcessor {
    /**
     * Loads an alias file, resolves imports recursively, and expands wildcards based on source structure.
     */
    static loadAndProcess(filePath: string, sourceTemplate: TemplateData): GuideData {
        if (!fs.existsSync(filePath)) {
            return {};
        }

        const content = fs.readFileSync(filePath, 'utf8');
        let aliasData = (yaml.load(content) || {}) as GuideData;

        const dir = path.dirname(filePath);
        aliasData = this.resolveImports(aliasData, dir);
        aliasData = this.transformToAliasObjects(aliasData) as GuideData;
        aliasData = this.expandWildcards(aliasData, sourceTemplate);

        return aliasData;
    }

    /**
     * Recursively transforms leaf strings into { _alias: string }.
     * Ignores keys starting with '_'.
     */
    private static transformToAliasObjects(data: YamlValue): YamlValue {
        if (typeof data === 'string') {
            return { _alias: data };
        }

        if (Array.isArray(data)) {
            return data.map((item) => this.transformToAliasObjects(item));
        }

        // YamlValue object check
        if (data && typeof data === 'object') {
            const result: Record<string, YamlValue> = {};
            // Object.entries on YamlValue (object type) needs casting or assumption it is Record<string, YamlValue>
            const record = data as Record<string, YamlValue>;

            for (const [key, val] of Object.entries(record)) {
                if (key.startsWith('_')) {
                    result[key] = val;
                    continue;
                }

                if (typeof val === 'string') {
                    result[key] = { _alias: val };
                } else {
                    result[key] = this.transformToAliasObjects(val);
                }
            }
            return result;
        }

        return data;
    }

    /**
     * Recursively resolves _imports.
     * Imports are merged first (base), then current data overrides them.
     */
    private static resolveImports(data: GuideData, baseDir: string): GuideData {
        if (!data || typeof data !== 'object') return data;

        let importedData: GuideData = {};

        // _imports can be defined in the GuideData
        const inputWithImports = data as GuideData & { _imports?: string[] };

        if (Array.isArray(inputWithImports._imports)) {
            for (const importFile of inputWithImports._imports) {
                const importPath = path.resolve(baseDir, importFile);
                if (fs.existsSync(importPath)) {
                    const content = fs.readFileSync(importPath, 'utf8');
                    let subData = (yaml.load(content) || {}) as GuideData;
                    const subDir = path.dirname(importPath);
                    subData = this.resolveImports(subData, subDir);
                    importedData = merge(importedData, subData);
                } else {
                    throw new FileNotFoundError(importPath, 'alias import resolution');
                }
            }
        }

        // Destructure to remove _imports from the merged result
        // We need to cast because destructuring with generic Record string is tricky in TS
        const { _imports, ...rest } = inputWithImports;
        const ownData = rest as GuideData;

        return merge(importedData, ownData);
    }

    /**
     * Expands '*' keys in aliasData based on array length in sourceData.
     */
    private static expandWildcards(aliasData: GuideData, sourceData: YamlValue): GuideData {
        if (!aliasData || typeof aliasData !== 'object') return aliasData;

        // Use a generic match: if Source is Array, and Alias has '*', expand it.
        if (Array.isArray(sourceData)) {
            // aliasData should be an object (Map) to support '*'
            if (aliasData['*']) {
                const wildcardTemplate = aliasData['*'];

                for (let i = 0; i < sourceData.length; i++) {
                    const indexKey = String(i);
                    aliasData[indexKey] = merge({}, wildcardTemplate, aliasData[indexKey]);
                }

                delete aliasData['*'];
            }
        }

        // Traverse Recursively
        for (const key of Object.keys(aliasData)) {
            let nextSource: YamlValue = undefined;

            if (Array.isArray(sourceData)) {
                const idx = parseInt(key, 10);
                if (!isNaN(idx) && sourceData[idx]) {
                    nextSource = sourceData[idx];
                }
            } else if (sourceData && typeof sourceData === 'object' && !Array.isArray(sourceData)) {
                nextSource = (sourceData as Record<string, YamlValue>)[key];
            }

            if (nextSource !== undefined) {
                if (typeof aliasData[key] === 'object' && aliasData[key] !== null) {
                    aliasData[key] = this.expandWildcards(aliasData[key] as GuideData, nextSource);
                }
            }
        }

        return aliasData;
    }
}
