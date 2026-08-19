import { DocDockConstants } from './constants';

export class RenderContext {
    constructor(
        public readonly level: number = 0,
        public readonly path: string | undefined = undefined,
        public readonly rawPath: string[] = [],
        public readonly copyPath: string = ''
    ) {}

    static create(segments: string[], isPropertiesBlock: boolean = false): RenderContext {
        let path = '';
        let copyPath = '';
        const rawPath: string[] = [];

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const sanitizedSegment = segment.replace(/[^a-zA-Z0-9_-]/g, '_');
            
            // For path (DOM ID)
            if (path) {
                // If it's a Properties block in CFn, append __Properties__ instead of __
                // but only for the element right after the logicalId (index 2)
                if (isPropertiesBlock && i === 2) {
                    path += `${DocDockConstants.PathSeparator}Properties${DocDockConstants.PathSeparator}${sanitizedSegment}`;
                } else {
                    path += `${DocDockConstants.PathSeparator}${sanitizedSegment}`;
                }
            } else {
                path = sanitizedSegment;
            }

            // For rawPath
            if (isPropertiesBlock && i === 2) {
                rawPath.push('Properties', segment);
            } else {
                rawPath.push(segment);
            }

            // For copyPath
            if (!copyPath) {
                copyPath = segment;
            } else if (segment.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix)) {
                copyPath += `[${segment}]`;
            } else if (/^\d+$/.test(segment)) {
                copyPath += '[]';
            } else {
                if (isPropertiesBlock && i === 2) {
                    copyPath += `.Properties.${segment}`;
                } else {
                    copyPath += `.${segment}`;
                }
            }
        }

        return new RenderContext(0, path, rawPath, copyPath);
    }

    derivePath(segment: string): string {
        const sanitizedSegment = segment.replace(/[^a-zA-Z0-9_-]/g, '_');
        return this.path ? `${this.path}${DocDockConstants.PathSeparator}${sanitizedSegment}` : sanitizedSegment;
    }

    deriveCopyPath(segment: string): string {
        if (!this.copyPath) return segment;

        // If segment starts with condition prefix, it's a condition key like [=name:web]
        if (segment.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix)) {
            return `${this.copyPath}[${segment}]`;
        }

        // If segment is purely numeric, it's an array index like []
        if (/^\d+$/.test(segment)) {
            return `${this.copyPath}${DocDockConstants.ReservedKeys.Array}`;
        }

        // Otherwise it's a normal property name
        return `${this.copyPath}.${segment}`;
    }

    child(segment?: string, rawSegment?: string, incrementLevel: boolean = true): RenderContext {
        const nextLevel = incrementLevel ? this.level + 1 : this.level;
        
        let nextPath = this.path;
        if (segment !== undefined) {
            nextPath = this.derivePath(segment);
        }

        const nextRawPath = [...this.rawPath];
        let nextCopyPath = this.copyPath;
        if (rawSegment !== undefined) {
            nextRawPath.push(rawSegment);
            nextCopyPath = this.deriveCopyPath(rawSegment);
        }

        return new RenderContext(nextLevel, nextPath, nextRawPath, nextCopyPath);
    }
}
