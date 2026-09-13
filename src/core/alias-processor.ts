import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { DocDockConstants } from './constants';
import { GuideData, TemplateData, YamlValue } from '../types';
import { AliasTreeBuilder } from './alias-tree-builder';
import { ImportResolver } from './import-resolver';

export class AliasProcessor {
    /**
     * Loads an alias file, resolves imports recursively, and expands wildcards based on source structure.
     */
    static loadAndProcess(filePath: string, _sourceTemplate: TemplateData): GuideData {
        if (!fs.existsSync(filePath)) {
            return {};
        }

        const content = fs.readFileSync(filePath, 'utf8');
        let aliasData = (yaml.load(content) || {}) as GuideData;

        const dir = path.dirname(filePath);
        aliasData = ImportResolver.resolve(aliasData, dir);
        aliasData = AliasTreeBuilder.build(aliasData);
        aliasData = this.transformToAliasObjects(aliasData) as GuideData;

        return aliasData;
    }

    /**
     * Recursively transforms leaf strings into { _alias: string }.
     * Ignores keys starting with '_'.
     */
    private static transformToAliasObjects(data: YamlValue): YamlValue {
        if (typeof data === 'string') {
            return { [DocDockConstants.ReservedKeys.Alias]: data };
        }

        if (Array.isArray(data)) {
            return data.map((item) => this.transformToAliasObjects(item));
        }

        if (!data || typeof data !== 'object') {
            return data;
        }

        const result: Record<string, YamlValue> = {};
        const record = data as Record<string, YamlValue>;

        for (const [key, val] of Object.entries(record)) {
            if (key === DocDockConstants.ReservedKeys.Match && Array.isArray(val)) {
                result[key] = val.map(item => this.transformToAliasObjects(item));
                continue;
            }
            
            if (key.startsWith('_')) {
                result[key] = val;
                continue;
            }

            if (typeof val !== 'string') {
                result[key] = this.transformToAliasObjects(val);
                continue;
            }

            // 単一キー構成のスカラーマッチャー判定
            const isConditionKey = key.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix);
            const hasOnlyOneKey = Object.keys(record).length === 1;

            if (isConditionKey && !hasOnlyOneKey) {
                result[key] = val;
            } else {
                result[key] = { [DocDockConstants.ReservedKeys.Alias]: val };
            }
        }
        return result;
    }
}
