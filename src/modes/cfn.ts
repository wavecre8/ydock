import * as yaml from 'js-yaml';
import { ModeStrategy, ResourceComponents } from './types';
import { YamlValue } from '../types';

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
     * Returns standard CFn top-level sections as mergeable keys.
     * This allows splitting "Resources" or "Parameters" across multiple files.
     */
    getMergeableKeys(): string[] {
        return ['Transform', 'Metadata', 'Parameters', 'Rules', 'Mappings', 'Conditions', 'Resources', 'Outputs'];
    }

    getSectionSortOrder(): string[] | undefined {
        return [
            'AWSTemplateFormatVersion',
            'Description',
            'Transform',
            'Metadata',
            'Parameters',
            'Rules',
            'Mappings',
            'Conditions',
            'Globals',
            'Resources',
            'Outputs'
        ];
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

    getSectionRenderType(sectionName: string): 'transform' | 'normal' {
        return sectionName === 'Transform' ? 'transform' : 'normal';
    }

    getDuplicateExemptKeys(): string[] {
        // Keys that are allowed to appear in multiple files and will be merged:
        // - AWSTemplateFormatVersion: First file wins (typically same value)
        // - Description: First file wins (single-value key)
        // - Metadata: Deep merged (is also in getMergeableKeys)
        return ['AWSTemplateFormatVersion', 'Description', 'Metadata'];
    }

    findPropertyFallback(obj: Record<string, YamlValue>, seg: string): YamlValue | undefined {
        if (obj.Properties && typeof obj.Properties === 'object' && seg in (obj.Properties as Record<string, YamlValue>)) {
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
}
