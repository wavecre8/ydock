import * as fs from 'fs';
import * as path from 'path';
import { Loader } from './loader';
import { Merger } from './merger';
import { AliasProcessor } from './alias-processor';
import { FileNotFoundError, DuplicateKeyError } from './errors';
import { ModeStrategy } from '../modes/types';
import { PageConfig, TemplateData, GuideData } from '../types';

export class SourceProcessor {
    /**
     * Process a single source file and merge it into master template/guide
     * @param sourcePath Path to the source YAML file
     * @param strategy Mode strategy for schema and merge behavior
     * @param page Page configuration
     * @param configPath Path to the config file
     * @param seenKeys Set of keys encountered so far (for duplicate detection)
     * @param descriptionList Accumulated description entries
     * @param masterTemplate Accumulated master template
     * @param masterGuide Accumulated master guide
     * @returns Merged template and guide
     */
    static process(
        sourcePath: string,
        strategy: ModeStrategy,
        page: PageConfig,
        configPath: string,
        seenKeys: Set<string>,
        descriptionList: Array<{ fileName: string; content: string }>,
        masterTemplate: TemplateData,
        masterGuide: GuideData,
        silent?: boolean
    ): { template: TemplateData; guide: GuideData } {
        if (!fs.existsSync(sourcePath)) {
            throw new FileNotFoundError(sourcePath, 'template merge');
        }

        const currentTemplate = Loader.loadTemplate(sourcePath, strategy.getSchema()) as TemplateData;

        // Extract and collect top-level Description field
        if (currentTemplate.Description && typeof currentTemplate.Description === 'string') {
            descriptionList.push({
                fileName: path.basename(sourcePath),
                content: currentTemplate.Description
            });
            delete currentTemplate.Description;
        }

        // Check for duplicate keys across multiple source files
        const exemptKeys = new Set(strategy.getDuplicateExemptKeys());
        strategy.getMergeableKeys().forEach((k: string) => exemptKeys.add(k));

        const newKeys = Object.keys(currentTemplate).filter((k) => !exemptKeys.has(k));
        const duplicates = newKeys.filter((k) => seenKeys.has(k));

        const hasCustomizer = !!strategy.getCustomizer;
        if (!hasCustomizer && duplicates.length > 0) {
            throw new DuplicateKeyError(sourcePath, duplicates);
        }

        newKeys.forEach((k) => seenKeys.add(k));

        const customizer = hasCustomizer ? strategy.getCustomizer!() : undefined;
        const mergedTemplate = Merger.mergeDescriptions([masterTemplate, currentTemplate], customizer);

        const sourceBaseName = path.basename(sourcePath, path.extname(sourcePath));

        let mergedGuide = masterGuide;
        const guideData = this.findAndLoadGuide(sourceBaseName, page.guideDir, configPath, silent);
        if (guideData) {
            mergedGuide = Merger.mergeDescriptions([mergedGuide, guideData]);
        }

        const aliasData = this.findAndProcessAlias(sourceBaseName, page.aliasDir, configPath, currentTemplate, silent);
        if (aliasData) {
            mergedGuide = Merger.mergeDescriptions([mergedGuide, aliasData], this.aliasCustomizer);
        }

        return {
            template: mergedTemplate,
            guide: mergedGuide
        };
    }

    /**
     * Find and load guide file for a given source
     * @param baseName Source file base name (without extension)
     * @param guideDir Guide directory (optional)
     * @param configPath Path to the config file
     * @returns Loaded guide data or null if not found
     */
    private static findAndLoadGuide(
        baseName: string,
        guideDir: string | undefined,
        configPath: string,
        silent?: boolean
    ): GuideData | null {
        if (!guideDir) {
            return null;
        }

        const configDir = path.dirname(configPath);
        const resolvedGuideDir = path.resolve(configDir, guideDir);

        const guideCandidates = [
            path.join(resolvedGuideDir, `${baseName}_guide.yaml`),
            path.join(resolvedGuideDir, `${baseName}_guide.yml`)
        ];

        for (const candidate of guideCandidates) {
            if (fs.existsSync(candidate)) {
                if (!silent) console.log(`  Found guide: ${candidate}`);
                return Loader.loadTemplate(candidate, undefined) as GuideData;
            }
        }

        return null;
    }

    /**
     * Find and process alias file for a given source
     * @param baseName Source file base name (without extension)
     * @param aliasDir Alias directory (optional)
     * @param configPath Path to the config file
     * @param template Current template data
     * @returns Processed alias data or null if not found
     */
    private static findAndProcessAlias(
        baseName: string,
        aliasDir: string | undefined,
        configPath: string,
        template: TemplateData,
        silent?: boolean
    ): GuideData | null {
        if (!aliasDir) {
            return null;
        }

        const configDir = path.dirname(configPath);
        const resolvedAliasDir = path.resolve(configDir, aliasDir);

        const aliasCandidates = [
            path.join(resolvedAliasDir, `${baseName}_alias.yaml`),
            path.join(resolvedAliasDir, `${baseName}_alias.yml`)
        ];

        for (const aliasPath of aliasCandidates) {
            if (fs.existsSync(aliasPath)) {
                if (!silent) console.log(`  Found alias: ${aliasPath}`);
                return AliasProcessor.loadAndProcess(aliasPath, template) as GuideData;
            }
        }

        return null;
    }

    /**
     * Custom merge function to preserve both guide descriptions and alias metadata
     */
    private static aliasCustomizer(objValue: unknown, srcValue: unknown): unknown {
        if (typeof objValue === 'string' && typeof srcValue === 'object' && srcValue !== null) {
            return { Description: objValue, ...srcValue };
        }
        return undefined;
    }
}
