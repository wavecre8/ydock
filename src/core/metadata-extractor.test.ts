import { describe, it, expect } from 'vitest';
import { MetadataExtractor } from './metadata-extractor';

describe('MetadataExtractor', () => {
    it('should extract metadata from an object', () => {
        const desc = {
            Description: 'This is a test',
            _alias: 'TestAlias'
        };
        const meta = MetadataExtractor.extractMetadata(desc);
        expect(meta.description).toBe('This is a test');
        expect(meta.alias).toBe('TestAlias');
    });

    it('should extract description using lower case key', () => {
        const desc = {
            description: 'lower case desc'
        };
        const meta = MetadataExtractor.extractMetadata(desc);
        expect(meta.description).toBe('lower case desc');
        expect(meta.alias).toBeUndefined();
    });

    it('should extract description from string', () => {
        const desc = 'Just a string';
        const meta = MetadataExtractor.extractMetadata(desc);
        expect(meta.description).toBe('Just a string');
        expect(meta.alias).toBeUndefined();
    });

    it('should return undefined for non-matching input', () => {
        const desc = 123;
        const meta = MetadataExtractor.extractMetadata(desc as any);
        expect(meta.description).toBeUndefined();
        expect(meta.alias).toBeUndefined();
    });
});
