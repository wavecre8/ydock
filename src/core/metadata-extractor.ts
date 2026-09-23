import { YamlValue, GuideMeta } from '../types';
import { DocDockConstants } from './constants';

export class MetadataExtractor {
    static isGuideMetaPotential(val: YamlValue): val is Record<string, YamlValue> {
        return typeof val === 'object' && val !== null;
    }

    static extractMetadata(desc: YamlValue): GuideMeta {
        if (this.isGuideMetaPotential(desc)) {
            const d = desc as Record<string, YamlValue>;

            const description =
                typeof d[DocDockConstants.ReservedKeys.DescriptionUpper] === 'string'
                    ? (d[DocDockConstants.ReservedKeys.DescriptionUpper] as string)
                    : typeof d[DocDockConstants.ReservedKeys.DescriptionLower] === 'string'
                      ? (d[DocDockConstants.ReservedKeys.DescriptionLower] as string)
                      : undefined;
            const alias =
                typeof d[DocDockConstants.ReservedKeys.Alias] === 'string'
                    ? (d[DocDockConstants.ReservedKeys.Alias] as string)
                    : undefined;

            return {
                description,
                alias
            };
        }
        if (typeof desc === 'string') {
            return { description: desc, alias: undefined };
        }
        return { description: undefined, alias: undefined };
    }
}
