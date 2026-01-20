import { merge, mergeWith } from 'lodash';
import { YamlTemplate, YamlValue } from '../types';

export class Merger {
    /**
     * Merges multiple description objects into one.
     * Later keys overwrite earlier keys.
     * Accepts an optional customizer for mergeWith.
     */
    static mergeDescriptions(
        sources: YamlTemplate[],
        customizer?: (
            objValue: YamlValue,
            srcValue: YamlValue,
            key: string,
            object: YamlValue,
            source: YamlValue,
            stack: unknown
        ) => unknown
    ): YamlTemplate {
        if (customizer) {
            return mergeWith({}, ...sources, customizer);
        }
        return merge({}, ...sources);
    }
}
