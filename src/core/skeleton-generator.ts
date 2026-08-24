import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Loader } from './loader';
import { DocDockConfig, PageConfig } from '../types';
import { ModeFactory } from '../modes/factory';
import { DocDockConstants } from './constants';
import { Logger } from './logger';
import { PathUtils } from './path-utils';

export interface SkeletonOptions {
    configPath: string;
    type?: 'alias' | 'guide' | 'exclude' | 'all';
    silent?: boolean;
}

export class SkeletonGenerator {
    static async generate(options: SkeletonOptions): Promise<void> {
        const resolvedConfigPath = path.resolve(options.configPath);
        if (options.silent) Logger.setSilent(true);
        Logger.info(`Loading config from ${resolvedConfigPath}...`);

        const config = Loader.loadConfig(resolvedConfigPath) as DocDockConfig;
        const globalMode = config.mode || 'generic';
        const type = options.type || 'all';
        
        for (const page of config.pages) {
            this.processPage(page, resolvedConfigPath, globalMode, type, options.silent);
        }

        Logger.info('Skeleton generation complete.');
    }

    private static processPage(
        page: PageConfig,
        configPath: string,
        globalMode: string,
        type: 'alias' | 'guide' | 'exclude' | 'all',
        silent?: boolean
    ): void {
        const configDir = PathUtils.getConfigDir(configPath);
        const pageMode = page.mode || globalMode;
        const strategy = ModeFactory.getStrategy(pageMode as any);
        const schema = strategy.getSchema();

        const aliasDirName = page.aliasDir || DocDockConstants.Defaults.AliasDir;
        const resolvedAliasDir = PathUtils.resolveRelative(configDir, aliasDirName);

        const guideDirName = page.guideDir || 'guides';
        const resolvedGuideDir = PathUtils.resolveRelative(configDir, guideDirName);

        const excludeDirName = page.excludeDir || DocDockConstants.Defaults.ExcludeDir;
        const resolvedExcludeDir = PathUtils.resolveRelative(configDir, excludeDirName);

        // Create directories if needed based on type
        if (type === 'all' || type === 'alias') {
            this.ensureDirectory(resolvedAliasDir, 'alias');
        }
        if (type === 'all' || type === 'guide') {
            this.ensureDirectory(resolvedGuideDir, 'guide');
        }
        if (type === 'all' || type === 'exclude') {
            this.ensureDirectory(resolvedExcludeDir, 'exclude');
        }

        const sources = page.sources || page.templates || [];
        for (const sourcePath of sources) {
            this.processSource(
                sourcePath,
                resolvedAliasDir,
                resolvedGuideDir,
                resolvedExcludeDir,
                configDir,
                schema,
                strategy,
                type,
                silent
            );
        }
    }

    private static processSource(
        sourcePath: string,
        aliasDir: string,
        guideDir: string,
        excludeDir: string,
        configDir: string,
        schema: yaml.Schema | undefined,
        strategy: any,
        type: 'alias' | 'guide' | 'exclude' | 'all',
        _silent?: boolean
    ): void {
        const resolvedSourcePath = PathUtils.resolveRelative(configDir, sourcePath);

        if (!fs.existsSync(resolvedSourcePath)) {
            Logger.warn(`Source not found: ${resolvedSourcePath}`);
            return;
        }

        const template = Loader.loadTemplate(resolvedSourcePath, schema);
        const templateFileName = path.basename(sourcePath, path.extname(sourcePath));

        if (type === 'all' || type === 'alias') {
            this.generateAlias(template, templateFileName, aliasDir, strategy);
        }
        if (type === 'all' || type === 'exclude') {
            this.generateExclude(template, templateFileName, excludeDir, strategy);
        }
        if (type === 'all' || type === 'guide') {
            this.generateGuide(template, templateFileName, guideDir, strategy);
        }
    }

    private static generateFlatSkeleton(
        template: any,
        templateFileName: string,
        targetDir: string,
        suffixYml: string,
        suffixYaml: string,
        defaultValue: string | boolean,
        typeName: string,
        strategy: any
    ): void {
        const flatKeys = new Set<string>();
        this.extractFlatKeys(template, '', flatKeys, strategy);

        const ymlCandidate = PathUtils.resolveRelative(targetDir, templateFileName + suffixYml);
        const yamlCandidate = PathUtils.resolveRelative(targetDir, templateFileName + suffixYaml);

        let targetPath = ymlCandidate;
        if (fs.existsSync(yamlCandidate) && !fs.existsSync(ymlCandidate)) {
            targetPath = yamlCandidate;
        }

        const formattedDefaultValue = typeof defaultValue === 'string' ? `"${defaultValue}"` : defaultValue;

        if (fs.existsSync(targetPath)) {
            const content = fs.readFileSync(targetPath, 'utf8');
            const doc = (yaml.load(content) || {}) as Record<string, any>;
            const existingKeys = new Set(Object.keys(doc));

            let appendText = '';
            for (const key of flatKeys) {
                if (!existingKeys.has(key)) {
                    if (typeName === 'exclude' && this.isAncestorExcluded(key, doc)) {
                        continue;
                    }
                    appendText += `"${key}": ${formattedDefaultValue}\n`;
                }
            }

            if (appendText) {
                const prefix = content.endsWith('\n') || content === '' ? '' : '\n';
                fs.appendFileSync(targetPath, prefix + appendText.trimEnd());
                Logger.info(`Appended missing keys to ${targetPath}`);
            } else {
                Logger.info(`No missing keys to append for ${targetPath}`);
            }
        } else {
            let newText = '';
            for (const key of flatKeys) {
                newText += `"${key}": ${formattedDefaultValue}\n`;
            }
            fs.writeFileSync(targetPath, newText.trimEnd());
            Logger.info(`Created skeleton ${typeName}: ${targetPath}`);
        }
    }

    private static isAncestorExcluded(key: string, doc: Record<string, any>): boolean {
        const ancestors = this.getAncestorPaths(key);
        for (const ancestor of ancestors) {
            if (doc[ancestor] === true) {
                return true;
            }
            if (doc[`${ancestor}.*`] === true) {
                return true;
            }
        }
        return false;
    }

    private static getAncestorPaths(key: string): string[] {
        const ancestors: string[] = [];
        let current = '';
        let i = 0;
        while (i < key.length) {
            if (key[i] === '.') {
                if (current) {
                    ancestors.push(current);
                }
                current += '.';
                i++;
            } else if (key.slice(i, i + 2) === '[]') {
                if (current) {
                    ancestors.push(current);
                }
                current += '[]';
                ancestors.push(current);
                i += 2;
                if (i < key.length && key[i] === '.') {
                    current += '.';
                    i++;
                }
            } else {
                current += key[i];
                i++;
            }
        }
        return ancestors.filter(a => a !== key && a.length > 0);
    }

    private static generateAlias(template: any, templateFileName: string, aliasDir: string, strategy: any): void {
        this.generateFlatSkeleton(
            template,
            templateFileName,
            aliasDir,
            DocDockConstants.FileSuffixes.AliasYml,
            DocDockConstants.FileSuffixes.AliasYaml,
            '',
            'alias',
            strategy
        );
    }

    private static generateExclude(template: any, templateFileName: string, excludeDir: string, strategy: any): void {
        this.generateFlatSkeleton(
            template,
            templateFileName,
            excludeDir,
            DocDockConstants.FileSuffixes.ExcludeYml,
            DocDockConstants.FileSuffixes.ExcludeYaml,
            false,
            'exclude',
            strategy
        );
    }

    private static ensureDirectory(dir: string, typeName: string): void {
        if (!fs.existsSync(dir)) {
            Logger.info(`Creating ${typeName} directory: ${dir}`);
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    private static generateGuide(template: any, templateFileName: string, guideDir: string, strategy: any): void {
        const skeletonGuide = this.generateGuideSkeleton(template, strategy);

        const ymlCandidate = PathUtils.resolveRelative(guideDir, templateFileName + DocDockConstants.FileSuffixes.GuideYml);
        const yamlCandidate = PathUtils.resolveRelative(guideDir, templateFileName + DocDockConstants.FileSuffixes.GuideYaml);

        let targetGuidePath = ymlCandidate;
        if (fs.existsSync(yamlCandidate) && !fs.existsSync(ymlCandidate)) {
            targetGuidePath = yamlCandidate;
        }

        if (fs.existsSync(targetGuidePath)) {
            const content = fs.readFileSync(targetGuidePath, 'utf8');
            const existingGuide = yaml.load(content) || {};
            const mergedGuide = this.mergeGuides(existingGuide, skeletonGuide);
            fs.writeFileSync(targetGuidePath, yaml.dump(mergedGuide, { lineWidth: -1, noRefs: true }));
            Logger.info(`Merged missing keys in ${targetGuidePath}`);
        } else {
            fs.writeFileSync(targetGuidePath, yaml.dump(skeletonGuide, { lineWidth: -1, noRefs: true }));
            Logger.info(`Created skeleton guide: ${targetGuidePath}`);
        }
    }

    private static extractFlatKeys(obj: any, prefix: string, keys: Set<string>, strategy: any): void {
        if (this.isIntrinsic(obj, strategy)) {
            return;
        }
        if (Array.isArray(obj)) {
            for (const item of obj) {
                this.extractFlatKeys(item, `${prefix}[]`, keys, strategy);
            }
        } else if (obj && typeof obj === 'object') {
            for (const [k, v] of Object.entries(obj)) {
                const newPrefix = prefix ? `${prefix}.${k}` : k;
                keys.add(newPrefix);
                this.extractFlatKeys(v, newPrefix, keys, strategy);
            }
        }
    }

    private static generateGuideSkeleton(template: any, strategy: any): any {
        if (this.isIntrinsic(template, strategy)) {
            return '';
        }
        if (Array.isArray(template)) {
            const result: any[] = [];
            for (const item of template) {
                if (typeof item === 'object' && item !== null) {
                    const keys = Object.keys(item);
                    const idKey = keys.find(k => ['key', 'name', 'id'].includes(k.toLowerCase())) || keys[0];
                    if (idKey) {
                        const matcherKey = `${DocDockConstants.ReservedKeys.ConditionPrefix}${idKey}`;
                        const matcherVal = item[idKey];
                        const guideItem: Record<string, any> = {};
                        guideItem[matcherKey] = matcherVal;
                        for (const key of keys) {
                            guideItem[key] = this.generateGuideSkeleton(item[key], strategy);
                        }
                        result.push(guideItem);
                    } else {
                        result.push({});
                    }
                } else if (item !== undefined && item !== null) {
                    const matcherKey = `${DocDockConstants.ReservedKeys.ConditionPrefix}${item}`;
                    const guideItem: Record<string, any> = {};
                    guideItem[matcherKey] = '';
                    result.push(guideItem);
                }
            }
            return result;
        } else if (typeof template === 'object' && template !== null) {
            const result: Record<string, any> = {};
            for (const [key, val] of Object.entries(template)) {
                result[key] = this.generateGuideSkeleton(val, strategy);
            }
            return result;
        } else {
            return '';
        }
    }

    private static mergeGuides(existing: any, skeleton: any): any {
        if (existing === undefined) return skeleton;
        if (skeleton === undefined) return existing;

        if (typeof existing === 'string' || typeof existing === 'boolean') {
            return existing;
        }
        if (existing && typeof existing === 'object' && '_hidden' in existing) {
            return existing;
        }

        if (Array.isArray(existing) && Array.isArray(skeleton)) {
            const result = [...existing];
            for (const skelItem of skeleton) {
                if (typeof skelItem === 'object' && skelItem !== null) {
                    const skelMatcherKey = Object.keys(skelItem).find(k => k.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix));
                    if (skelMatcherKey) {
                        const skelMatcherVal = skelItem[skelMatcherKey];
                        const existingItem = existing.find(exItem => 
                            typeof exItem === 'object' && 
                            exItem !== null && 
                            exItem[skelMatcherKey] === skelMatcherVal
                        );
                        if (existingItem) {
                            const idx = result.indexOf(existingItem);
                            result[idx] = this.mergeGuides(existingItem, skelItem);
                        } else {
                            result.push(skelItem);
                        }
                    } else {
                        result.push(skelItem);
                    }
                } else {
                    if (!existing.includes(skelItem)) {
                        result.push(skelItem);
                    }
                }
            }
            return result;
        }

        if (typeof existing === 'object' && existing !== null && typeof skeleton === 'object' && skeleton !== null && !Array.isArray(existing) && !Array.isArray(skeleton)) {
            const result = { ...existing };
            for (const [key, val] of Object.entries(skeleton)) {
                if (key in existing) {
                    result[key] = this.mergeGuides(existing[key], val);
                } else {
                    result[key] = val;
                }
            }
            return result;
        }

        return existing;
    }

    private static isIntrinsic(val: any, strategy: any): boolean {
        if (strategy && typeof strategy.isIntrinsic === 'function') {
            return strategy.isIntrinsic(val);
        }
        if (val === null || typeof val !== 'object' || Array.isArray(val)) return false;
        const keys = Object.keys(val);
        return keys.length === 1 && (keys[0].startsWith('!') || keys[0].startsWith('Fn::'));
    }
}
