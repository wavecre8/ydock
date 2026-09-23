import { DocDockConstants } from './constants';

export class RenderContext {
    constructor(
        public readonly level: number = 0,
        public readonly path: string | undefined = undefined,
        public readonly rawPath: string[] = [],
        public readonly copyPath: string = ''
    ) {}

    // パスセグメントからRenderContextインスタンスを生成
    static create(segments: string[], isPropertiesBlock: boolean = false, docPrefix?: string): RenderContext {
        // 完全解決済みセグメント列の正規化
        const effectiveSegments: string[] = [];
        for (let i = 0; i < segments.length; i++) {
            if (isPropertiesBlock && i === 2 && segments[i] !== 'Properties') {
                effectiveSegments.push('Properties');
            }
            effectiveSegments.push(segments[i]);
        }

        let path = '';
        let copyPath = '';
        const rawPath: string[] = [];

        for (const segment of effectiveSegments) {
            // 角括弧や記号をサニタイズ対象から除外したパス文字の置換処理
            const sanitizedSegment = segment.replace(/[^a-zA-Z0-9_\-[\]=.:]/g, '_');

            // DOM ID用のパス組み立て処理
            if (path) {
                path += `${DocDockConstants.PathSeparator}${sanitizedSegment}`;
            } else {
                path = docPrefix
                    ? `${docPrefix}${DocDockConstants.PathSeparator}${sanitizedSegment}`
                    : sanitizedSegment;
            }

            rawPath.push(segment);

            // コピー用パスの組み立て処理
            const copySeg = RenderContext.formatCopySegment(segment);
            if (!copyPath) {
                copyPath = copySeg;
            } else if (copySeg.startsWith('[')) {
                copyPath += copySeg;
            } else {
                copyPath += `.${copySeg}`;
            }
        }

        return new RenderContext(0, path, rawPath, copyPath);
    }

    static formatCopySegment(segment: string): string {
        if (segment.startsWith('[') && segment.endsWith(']')) {
            return segment;
        }
        if (segment.includes('=')) {
            return `[${segment}]`;
        }
        if (/^\d+$/.test(segment)) {
            return `[${segment}]`;
        }
        if (segment.includes('.')) {
            return `[${segment}]`;
        }
        return segment;
    }

    derivePath(segment: string): string {
        // 角括弧や記号をサニタイズ対象から除外したパス文字の置換処理
        const sanitizedSegment = segment.replace(/[^a-zA-Z0-9_\-[\]=.:]/g, '_');
        return this.path ? `${this.path}${DocDockConstants.PathSeparator}${sanitizedSegment}` : sanitizedSegment;
    }

    deriveCopyPath(segment: string): string {
        const copySeg = RenderContext.formatCopySegment(segment);
        if (!this.copyPath) return copySeg;
        if (copySeg.startsWith('[')) {
            return `${this.copyPath}${copySeg}`;
        }
        return `${this.copyPath}.${copySeg}`;
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
