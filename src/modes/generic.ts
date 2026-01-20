import * as yaml from 'js-yaml';
import { ModeStrategy, MergeCustomizer, ResourceComponents } from './types';
import { YamlValue } from '../types';
import * as _ from 'lodash';

export class GenericStrategy implements ModeStrategy {
    getSchema(): yaml.Schema {
        return yaml.DEFAULT_SCHEMA;
    }

    /**
     * Returns empty array to rely on customizer for deep merging.
     */
    getMergeableKeys(): string[] {
        // Empty means we rely on the customizer for essentially all merging.
        return [];
    }

    /**
     * Provides custom merge logic for Generic mode:
     * 1. Arrays: Concatenate
     * 2. Scalar Conflicts: Convert to List
     * 3. Mixed Types: Concatenate as List
     */
    getCustomizer(): MergeCustomizer {
        return (objValue, srcValue) => {
            // 1. Array Concatenation (Array + Array)
            if (Array.isArray(objValue) && Array.isArray(srcValue)) {
                return objValue.concat(srcValue);
            }

            // 2. Scalar Conflict Resolution (Scalar + Scalar -> Array)
            // If both are primitives and different, allow coexistence by converting to List.
            if (!_.isObject(objValue) && !_.isObject(srcValue) && objValue !== srcValue && objValue !== undefined) {
                return [objValue, srcValue];
            }

            // 3. Mixed Type Resolution (Array + Scalar / Scalar + Array) -> Array
            // If one is array and other is scalar, we concat them.
            if (Array.isArray(objValue) && !_.isObject(srcValue)) {
                return objValue.concat(srcValue);
            }
            if (!_.isObject(objValue) && Array.isArray(srcValue) && objValue !== undefined) {
                return [objValue].concat(srcValue);
            }

            // 4. Type Mismatch
            // Fallback to lodash default (overwrite). No logging.
        };
    }

    getSectionSortOrder(): string[] | undefined {
        return undefined;
    }

    isIntrinsic(_val: unknown): boolean {
        return false;
    }

    getIgnoredSections(): string[] {
        return [];
    }

    getAttributes(): string[] {
        return [];
    }

    getSectionRenderType(_sectionName: string): 'transform' | 'normal' {
        return 'normal';
    }

    getDuplicateExemptKeys(): string[] {
        return [];
    }

    getResourceComponents(resource: unknown, _sectionName: string): ResourceComponents {
        const properties: Array<{ key: string; val: YamlValue }> = [];

        if (resource && typeof resource === 'object') {
            Object.entries(resource).forEach(([k, v]) => {
                properties.push({ key: k, val: v });
            });
        }

        return {
            typeLabel: undefined,
            attributes: [],
            properties
        };
    }
}
