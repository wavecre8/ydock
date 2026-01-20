import { Schema } from 'js-yaml';
import { YamlValue } from '../types';

/**
 * Type definition for lodash.mergeWith customizer function.
 * @param objValue Value at the destination
 * @param srcValue Value at the source
 * @param key The key of the property being merged
 * @param object The destination object
 * @param source The source object
 * @param stack The stack of traversed objects (internal lodash tracking)
 */
export type MergeCustomizer = (
    objValue: unknown,
    srcValue: unknown,
    key: string,
    object: unknown,
    source: unknown,
    stack: unknown
) => unknown;

export interface ResourceComponents {
    typeLabel?: string;
    properties: Array<{ key: string; val: YamlValue }>;
    attributes: Array<{ key: string; val: YamlValue }>;
}

/**
 * Strategy interface for parsing and merging different document modes (e.g., CloudFormation vs Generic).
 */
export interface ModeStrategy {
    /**
     * Returns the YAML schema to use for parsing.
     */
    getSchema(): Schema;

    /**
     * Returns keys that should be merged at the top level.
     * If empty, custom logic (via customizer) or default strict duplicate checks will apply.
     */
    getMergeableKeys(): string[];

    /**
     * Returns a customizer function for lodash.mergeWith.
     * If undefined, default lodash merge behavior (overwrite for conflicts) is used.
     */
    getCustomizer?(): MergeCustomizer;

    /**
     * Returns the preferred sort order for top-level sections.
     * If undefined, no specific sort order is enforced.
     */
    getSectionSortOrder(): string[] | undefined;

    /**
     * Checks if a value is an intrinsic function (e.g. CloudFormation Fn::Sub).
     */
    isIntrinsic(val: unknown): boolean;

    /**
     * Returns a list of top-level keys to ignore/hide from the main documentation loop.
     */
    getIgnoredSections(): string[];

    /**
     * Returns a list of keys that should be treated as resource attributes (e.g. DependsOn, Condition).
     */
    getAttributes(): string[];

    /**
     * Analyzes a resource object and splits it into type, attributes, and properties.
     * This abstracts the structure of the resource (e.g. Properties block vs flat structure).
     */
    getResourceComponents(resource: unknown, sectionName: string): ResourceComponents;

    /**
     * Returns the type of section for rendering purposes.
     * @returns 'transform' | 'normal'
     */
    getSectionRenderType(sectionName: string): 'transform' | 'normal';

    /**
     * Returns a list of top-level keys that are exempt from duplicate checks during multi-file merging.
     * These keys can appear in multiple files without causing errors.
     * They will be merged according to the customizer logic or default merge behavior.
     */
    getDuplicateExemptKeys(): string[];
}
