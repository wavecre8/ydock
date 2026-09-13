import * as fs from 'fs';
import * as path from 'path';
import { Loader } from './loader';
import { Merger } from './merger';
import { AliasProcessor } from './alias-processor';
import { ExcludeProcessor } from './exclude-processor';
import { FileNotFoundError, DuplicateKeyError } from './errors';
import { Logger } from './logger';
import { DocDockConstants } from './constants';
import { PathUtils } from './path-utils';
import { ModeStrategy } from '../modes/types';
import { PageConfig, TemplateData, GuideData, ExcludeTree } from '../types';
import { ImportResolver } from './import-resolver';

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
        masterExcludeTree: ExcludeTree,
        silent?: boolean
    ): { template: TemplateData; guide: GuideData; excludeTree: ExcludeTree } {
        const configDir = PathUtils.getConfigDir(configPath);
        const resolvedSourcePath = PathUtils.resolveRelative(configDir, sourcePath);

        if (!fs.existsSync(resolvedSourcePath)) {
            throw new FileNotFoundError(resolvedSourcePath, 'template merge');
        }

        const currentTemplate = Loader.loadTemplate(resolvedSourcePath, strategy.getSchema()) as TemplateData;

        // Extract and collect top-level Description field
        const descKey = DocDockConstants.ReservedKeys.DescriptionUpper;
        if (currentTemplate[descKey] && typeof currentTemplate[descKey] === 'string') {
            descriptionList.push({
                fileName: path.basename(sourcePath),
                content: currentTemplate[descKey]
            });
            delete currentTemplate[descKey];
        }

        // Check for duplicate keys across multiple source files
        const exemptKeys = new Set(strategy.getDuplicateExemptKeys());
        strategy.getMergeableKeys().forEach((k: string) => exemptKeys.add(k));

        const newKeys = Object.keys(currentTemplate).filter((k) => !exemptKeys.has(k));
        const duplicates = newKeys.filter((k) => seenKeys.has(k));

        // 重複キー検出時のエラー送出
        if (duplicates.length > 0) {
            throw new DuplicateKeyError(sourcePath, duplicates);
        }

        newKeys.forEach((k) => seenKeys.add(k));

        // カスタムマイザー取得
        const customizer = strategy.getCustomizer ? strategy.getCustomizer() : undefined;
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

        let mergedExcludeTree = masterExcludeTree;
        const excludeData = this.findAndProcessExclude(sourceBaseName, page.excludeDir, configPath, silent);
        if (excludeData) {
            mergedExcludeTree = Merger.mergeDescriptions([mergedExcludeTree, excludeData]);
        }

        return {
            template: mergedTemplate,
            guide: mergedGuide,
            excludeTree: mergedExcludeTree
        };
    }

    /**
     * Find and process exclude file for a given source
     */
    private static findAndProcessExclude(
        baseName: string,
        excludeDir: string | undefined,
        configPath: string,
        silent?: boolean
    ): ExcludeTree | null {
        if (!excludeDir) return null;

        const configDir = path.dirname(configPath);
        const resolvedExcludeDir = path.resolve(configDir, excludeDir);

        const extensions = [DocDockConstants.FileSuffixes.ExcludeYaml, DocDockConstants.FileSuffixes.ExcludeYml];
        const candidate = PathUtils.findFileWithExtensions(resolvedExcludeDir, baseName, extensions);

        if (candidate) {
            if (!silent) Logger.info(`  Found exclude: ${candidate}`);
            return ExcludeProcessor.loadAndProcess(candidate, path.dirname(candidate)) as ExcludeTree;
        }

        return null;
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
        if (!guideDir) return null;

        const configDir = path.dirname(configPath);
        const resolvedGuideDir = path.resolve(configDir, guideDir);

        const extensions = [DocDockConstants.FileSuffixes.GuideYaml, DocDockConstants.FileSuffixes.GuideYml];
        const candidate = PathUtils.findFileWithExtensions(resolvedGuideDir, baseName, extensions);

        if (candidate) {
            if (!silent) Logger.info(`  Found guide: ${candidate}`);
            const guideData = Loader.loadTemplate(candidate, undefined) as GuideData;
            return ImportResolver.resolve(guideData, path.dirname(candidate));
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
        if (!aliasDir) return null;

        const configDir = path.dirname(configPath);
        const resolvedAliasDir = path.resolve(configDir, aliasDir);

        const extensions = [DocDockConstants.FileSuffixes.AliasYaml, DocDockConstants.FileSuffixes.AliasYml];
        const candidate = PathUtils.findFileWithExtensions(resolvedAliasDir, baseName, extensions);

        if (candidate) {
            if (!silent) Logger.info(`  Found alias: ${candidate}`);
            return AliasProcessor.loadAndProcess(candidate, template) as GuideData;
        }

        return null;
    }

    /**
     * Custom merge function to preserve both guide descriptions and alias metadata
     */
    private static aliasCustomizer(objValue: unknown, srcValue: unknown): unknown {
        const descKey = DocDockConstants.ReservedKeys.DescriptionUpper;
        if (typeof objValue === 'string' && typeof srcValue === 'object' && srcValue !== null && !Array.isArray(srcValue)) {
            return { [descKey]: objValue, ...srcValue };
        }
        if (typeof objValue === 'object' && objValue !== null && !Array.isArray(objValue) && typeof srcValue === 'string') {
            return { ...objValue, [descKey]: srcValue };
        }

        if (Array.isArray(objValue) && typeof srcValue === 'object' && srcValue !== null && !Array.isArray(srcValue)) {
            // ガイド側が配列で、エイリアス側がオブジェクトの場合のマージ処理
            return Merger.mergeAliasObjectWithArray(
                srcValue as Record<string, any>,
                objValue as any[],
                SourceProcessor.aliasCustomizer
            );
        }

        if (typeof objValue === 'object' && objValue !== null && !Array.isArray(objValue) && Array.isArray(srcValue)) {
            // 既存ガイド側がオブジェクトで、後続ガイド側が配列の場合のマージ処理
            return Merger.mergeAliasObjectWithArray(
                objValue as Record<string, any>,
                srcValue as any[],
                SourceProcessor.aliasCustomizer
            );
        }

        return undefined;
    }
}
