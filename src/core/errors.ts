/**
 * Custom error types for ydock
 */

export class FileNotFoundError extends Error {
    constructor(
        public readonly filePath: string,
        public readonly operation: string
    ) {
        super(`File not found during ${operation}: ${filePath}`);
        this.name = 'FileNotFoundError';
    }
}

export class DuplicateKeyError extends Error {
    constructor(
        public readonly filePath: string,
        public readonly duplicateKeys: string[]
    ) {
        super(`Duplicate keys found in ${filePath}: ${duplicateKeys.join(', ')}. Merge is not allowed.`);
        this.name = 'DuplicateKeyError';
    }
}

export class TemplateProcessingError extends Error {
    constructor(
        message: string,
        public readonly templatePath?: string,
        public readonly cause?: Error
    ) {
        super(message);
        this.name = 'TemplateProcessingError';
        if (cause) {
            this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
        }
    }
}
