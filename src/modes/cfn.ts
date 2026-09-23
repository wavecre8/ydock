import * as yaml from 'js-yaml';
import * as path from 'path';
import { ModeStrategy, ResourceComponents, DocumentMode } from './types';
import { YamlValue } from '../types';
import { DocDockConstants } from '../core/constants';

// Common CloudFormation intrinsic functions
const CLOUDFORMATION_TAGS = [
    'Ref',
    'Sub',
    'GetAtt',
    'Join',
    'Select',
    'Split',
    'FindInMap',
    'GetAZs',
    'Base64',
    'Cidr',
    'If',
    'Not',
    'Equals',
    'And',
    'Or',
    'ImportValue',
    'Condition',
    'ForEach',
    'Length',
    'ToJsonString',
    'Transform',
    'Contains',
    'EachMemberEquals',
    'EachMemberIn',
    'RefAll',
    'ValueOf'
];

const CUSTOM_TAGS: string[] = [];

const ALL_TAGS = [...CLOUDFORMATION_TAGS, ...CUSTOM_TAGS];

// Create YAML type definitions for all tags
const yamlTypes = ALL_TAGS.flatMap((tag) => [
    // Scalar: !Ref MyResource
    new yaml.Type('!' + tag, {
        kind: 'scalar',
        construct: (data) => ({ [`!${tag}`]: data })
    }),
    // Sequence: !Split ["|", "a|b|c"]
    new yaml.Type('!' + tag, {
        kind: 'sequence',
        construct: (data) => ({ [`!${tag}`]: data })
    }),
    // Mapping: !If [condition, value1, value2]
    new yaml.Type('!' + tag, {
        kind: 'mapping',
        construct: (data) => ({ [`!${tag}`]: data })
    })
]);

// Custom YAML schema with tag support
const CFN_SCHEMA = yaml.DEFAULT_SCHEMA.extend(yamlTypes);

/**
 * Strategy implementation for AWS CloudFormation templates.
 * Supports intrinsic functions like !Ref, !Sub, etc.
 */
export class CfnStrategy implements ModeStrategy {
    getSchema(): yaml.Schema {
        return CFN_SCHEMA;
    }

    /**
     * プロパティ格納ブロックのキー名を取得
     */
    getPropertiesKey(): string {
        return DocDockConstants.Cfn.PropertiesKey;
    }

    /**
     * モード種別の取得
     */
    getMode(): DocumentMode {
        return DocumentMode.Cfn;
    }

    /**
     * Returns standard CFn top-level sections as mergeable keys.
     * This allows splitting "Resources" or "Parameters" across multiple files.
     */
    getMergeableKeys(): string[] {
        const S = DocDockConstants.Cfn.Sections;
        return [S.Transform, S.Metadata, S.Parameters, S.Rules, S.Mappings, S.Conditions, S.Resources, S.Outputs];
    }

    getSectionSortOrder(): string[] | undefined {
        const S = DocDockConstants.Cfn.Sections;
        return [
            S.AWSTemplateFormatVersion,
            S.Description,
            S.Transform,
            S.Metadata,
            S.Parameters,
            S.Rules,
            S.Mappings,
            S.Conditions,
            S.Globals,
            S.Resources,
            S.Outputs
        ];
    }

    /**
     * トップレベルセクションとして認識されるキーであるかの判定
     */
    isKnownTopLevelSection(sectionName: string): boolean {
        return Object.values(DocDockConstants.Cfn.Sections).includes(sectionName as any);
    }

    /**
     * 省略されたセグメント列に対するモード固有の補完処理
     */
    completeOmittedSegments(segments: string[]): { segments: string[]; isPropertiesBlock: boolean } {
        const resolved = [...segments];
        let isPropertiesBlock = false;
        if (resolved.length === 0) {
            return { segments: resolved, isPropertiesBlock };
        }
        if (!this.isKnownTopLevelSection(resolved[0])) {
            resolved.unshift(DocDockConstants.Cfn.Sections.Resources);
        }
        if (resolved.length >= 3 && resolved[0] === DocDockConstants.Cfn.Sections.Resources) {
            const knownAttributes = [DocDockConstants.Cfn.TypeKey, ...this.getAttributes()];
            if (resolved[2] !== DocDockConstants.Cfn.PropertiesKey && !knownAttributes.includes(resolved[2])) {
                resolved.splice(2, 0, DocDockConstants.Cfn.PropertiesKey);
                isPropertiesBlock = true;
            }
        }
        return { segments: resolved, isPropertiesBlock };
    }

    isIntrinsic(val: unknown): boolean {
        if (val === null || typeof val !== 'object') return false;
        if (Array.isArray(val)) return false;
        const keys = Object.keys(val);
        // Special case for Fn::Sub with array [String, VarMap]
        // But generic rule is keys.length === 1 and start with ! or Fn::
        return keys.length === 1 && (keys[0].startsWith('!') || keys[0].startsWith('Fn::'));
    }

    getIgnoredSections(): string[] {
        return [];
    }

    getAttributes(): string[] {
        return [
            'Condition',
            'DependsOn',
            'DeletionPolicy',
            'UpdateReplacePolicy',
            'CreationPolicy',
            'UpdatePolicy',
            'Metadata'
        ];
    }

    getCustomizer(): import('./types').MergeCustomizer {
        return (objValue, srcValue, key) => {
            if (key === 'Transform') {
                const objArray = Array.isArray(objValue) ? objValue : objValue ? [objValue] : [];
                const srcArray = Array.isArray(srcValue) ? srcValue : srcValue ? [srcValue] : [];
                // Return unique concatenated array
                return Array.from(new Set([...objArray, ...srcArray]));
            }
            // Return undefined to let lodash handle other keys
            return undefined;
        };
    }

    /**
     * レンダリング時のセクション種別判定
     */
    getSectionRenderType(sectionName: string): 'scalar_list' | 'transform' | 'text' | 'normal' {
        if (sectionName === 'Transform') {
            return 'scalar_list';
        }
        if (sectionName === 'Description') {
            return 'text';
        }
        return 'normal';
    }

    /**
     * テンプレートの前処理正規化
     */
    normalizeTemplate(
        template: Record<string, YamlValue>,
        docMeta?: { mode?: string; sourcePath?: string; sourceBaseName?: string }
    ): Record<string, YamlValue> {
        const normalized = { ...template };
        // 単一文字列スカラーで指定されたTransformの配列化
        if (typeof normalized.Transform === 'string') {
            normalized.Transform = [normalized.Transform];
        }
        // Descriptionのファイル名属性付きオブジェクト化
        if (
            typeof normalized.Description === 'string' &&
            (docMeta?.mode === 'cfn' || docMeta?.sourcePath || docMeta?.sourceBaseName)
        ) {
            const fileName = docMeta.sourcePath
                ? path.basename(docMeta.sourcePath)
                : docMeta.sourceBaseName
                  ? `${docMeta.sourceBaseName}.yml`
                  : 'Description';
            normalized.Description = [{ fileName, content: normalized.Description }];
        }
        return normalized;
    }

    /**
     * リソース定義コレクションセクションの判定
     */
    isResourceSection(sectionName: string): boolean {
        return sectionName.toLowerCase() === 'resources';
    }

    getDuplicateExemptKeys(): string[] {
        // Keys that are allowed to appear in multiple files and will be merged:
        // - AWSTemplateFormatVersion: First file wins (typically same value)
        // - Description: First file wins (single-value key)
        // - Metadata: Deep merged (is also in getMergeableKeys)
        return ['AWSTemplateFormatVersion', 'Description', 'Metadata'];
    }

    findPropertyFallback(obj: Record<string, YamlValue>, seg: string): YamlValue | undefined {
        if (
            obj.Properties &&
            typeof obj.Properties === 'object' &&
            seg in (obj.Properties as Record<string, YamlValue>)
        ) {
            return (obj.Properties as Record<string, YamlValue>)[seg];
        }
        return undefined;
    }

    getResourceComponents(resource: unknown, _sectionName: string): ResourceComponents {
        if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
            return { typeLabel: undefined, attributes: [], properties: [] };
        }

        const resourceObj = resource as Record<string, YamlValue>;
        const typeLabel = 'Type' in resourceObj ? String(resourceObj.Type) : undefined;
        const attributes: Array<{ key: string; val: YamlValue }> = [];
        const properties: Array<{ key: string; val: YamlValue }> = [];

        const CFN_ATTRIBUTES = this.getAttributes();

        CFN_ATTRIBUTES.forEach((attr) => {
            if (attr in resourceObj && resourceObj[attr] !== undefined) {
                attributes.push({ key: attr, val: resourceObj[attr] });
            }
        });

        if (
            'Properties' in resourceObj &&
            resourceObj.Properties &&
            typeof resourceObj.Properties === 'object' &&
            !Array.isArray(resourceObj.Properties)
        ) {
            Object.entries(resourceObj.Properties as Record<string, YamlValue>).forEach(([k, v]) => {
                properties.push({ key: k, val: v });
            });
        } else {
            const IGNORED_ROOT_KEYS = ['Type', ...CFN_ATTRIBUTES];
            Object.entries(resourceObj).forEach(([k, v]) => {
                if (!IGNORED_ROOT_KEYS.includes(k)) {
                    properties.push({ key: k, val: v });
                }
            });
        }

        return { typeLabel, attributes, properties };
    }

    // リソースにおけるPropertiesブロックの保持判定
    hasPropertiesBlock(resource: unknown): boolean {
        if (!resource || typeof resource !== 'object' || Array.isArray(resource)) return false;
        return (
            'Properties' in (resource as Record<string, unknown>) && !!(resource as Record<string, unknown>).Properties
        );
    }

    // リソースのプロパティ対象オブジェクトの抽出
    getTargetObject(resource: unknown): unknown {
        if (this.hasPropertiesBlock(resource)) {
            return (resource as Record<string, unknown>).Properties;
        }
        return resource;
    }

    // リソース個別プロパティのガイド定義の取得
    getResourcePropertyGuide(
        doc: any,
        sectionName: string,
        logicalId: string,
        propKey: string,
        resource?: unknown
    ): YamlValue {
        if (this.hasPropertiesBlock(resource)) {
            return doc?.description?.[sectionName]?.[logicalId]?.Properties?.[propKey];
        }
        return doc?.description?.[sectionName]?.[logicalId]?.[propKey];
    }

    // リソース全体のルートガイド定義の取得
    getResourceRootGuide(doc: any, sectionName: string, logicalId: string, resource?: unknown): YamlValue {
        if (this.hasPropertiesBlock(resource)) {
            return doc?.description?.[sectionName]?.[logicalId]?.Properties;
        }
        return doc?.description?.[sectionName]?.[logicalId];
    }

    // 構造化テキストセクション判定
    isStructuredTextSection(sectionName: string, sectionData: unknown): boolean {
        if (sectionName !== 'Description') return false;
        let entries: Array<[string, unknown]> = [];
        if (Array.isArray(sectionData)) {
            entries = sectionData.map((item, idx) => [String(idx), item]);
        } else if (typeof sectionData === 'object' && sectionData !== null) {
            entries = Object.entries(sectionData);
        }
        return (
            entries.length > 0 &&
            typeof entries[0][1] === 'object' &&
            entries[0][1] !== null &&
            'fileName' in entries[0][1]
        );
    }

    // マークダウン形式テキストセクション判定
    isMarkdownTextSection(sectionName: string): boolean {
        return sectionName === 'Description';
    }
}
