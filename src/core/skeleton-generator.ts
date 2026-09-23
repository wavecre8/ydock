import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Loader } from './loader';
import { DefinitionLoader } from './definition-loader';
import { DocDockConfig, PageConfig } from '../types';
import { ModeFactory } from '../modes/factory';
import { DocDockConstants } from './constants';
import { Logger } from './logger';
import { PathUtils } from './path-utils';
import { PathParser } from './path-parser';
import { ConditionEvaluator } from './condition-evaluator';

import { ConfigUtils } from './config-utils';

export type SkeletonType = (typeof DocDockConstants.SkeletonTypes)[keyof typeof DocDockConstants.SkeletonTypes];

export interface SkeletonOptions {
    configPath: string;
    type?: SkeletonType;
    silent?: boolean;
}

export class SkeletonGenerator {
    static async generate(options: SkeletonOptions): Promise<void> {
        const resolvedConfigPath = path.resolve(options.configPath);
        if (options.silent) Logger.setSilent(true);
        Logger.info(`Loading config from ${resolvedConfigPath}...`);

        const config = Loader.loadConfig(resolvedConfigPath) as DocDockConfig;
        // ページ設定の存在および配列判定
        if (!config || !Array.isArray(config.pages) || config.pages.length === 0) {
            Logger.warn('No pages defined in configuration.');
            return;
        }

        const globalMode = config.mode || DocDockConstants.Defaults.Mode;
        const type = options.type || DocDockConstants.SkeletonTypes.All;
        const validTypes = Object.values(DocDockConstants.SkeletonTypes) as string[];

        // 指定種別の妥当性検証
        if (!validTypes.includes(type)) {
            throw new Error(`Invalid skeleton type: '${type}'. Allowed types are: ${validTypes.join(', ')}`);
        }

        // 補完済みページ設定一覧の取得
        const effectivePages = ConfigUtils.getEffectivePages(config);
        for (const effectivePage of effectivePages) {
            this.processPage(effectivePage, resolvedConfigPath, globalMode, type, options.silent);
        }

        Logger.info('Skeleton generation complete.');
    }

    private static processPage(
        page: PageConfig,
        configPath: string,
        globalMode: string,
        type: SkeletonType,
        silent?: boolean
    ): void {
        const configDir = PathUtils.getConfigDir(configPath);
        const pageMode = page.mode || globalMode;
        const strategy = ModeFactory.getStrategy(pageMode as any);
        const schema = strategy.getSchema();

        const aliasDirName = page.aliasDir || DocDockConstants.Defaults.AliasDir;
        const resolvedAliasDir = PathUtils.resolveRelative(configDir, aliasDirName);

        const guideDirName = page.guideDir || DocDockConstants.Defaults.GuideDir;
        const resolvedGuideDir = PathUtils.resolveRelative(configDir, guideDirName);

        const excludeDirName = page.excludeDir || DocDockConstants.Defaults.ExcludeDir;
        const resolvedExcludeDir = PathUtils.resolveRelative(configDir, excludeDirName);

        // Create directories if needed based on type
        if (type === DocDockConstants.SkeletonTypes.All || type === DocDockConstants.SkeletonTypes.Alias) {
            this.ensureDirectory(resolvedAliasDir, 'alias');
        }
        if (type === DocDockConstants.SkeletonTypes.All || type === DocDockConstants.SkeletonTypes.Guide) {
            this.ensureDirectory(resolvedGuideDir, 'guide');
        }
        if (type === DocDockConstants.SkeletonTypes.All || type === DocDockConstants.SkeletonTypes.Exclude) {
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
        type: SkeletonType,
        _silent?: boolean
    ): void {
        const resolvedSourcePath = PathUtils.resolveRelative(configDir, sourcePath);

        if (!fs.existsSync(resolvedSourcePath)) {
            Logger.warn(`Source not found: ${resolvedSourcePath}`);
            return;
        }

        const template = Loader.loadTemplate(resolvedSourcePath, schema);

        if (type === DocDockConstants.SkeletonTypes.All || type === DocDockConstants.SkeletonTypes.Alias) {
            this.generateAlias(template, sourcePath, aliasDir, configDir, strategy);
        }
        if (type === DocDockConstants.SkeletonTypes.All || type === DocDockConstants.SkeletonTypes.Exclude) {
            this.generateExclude(template, sourcePath, excludeDir, configDir, strategy);
        }
        if (type === DocDockConstants.SkeletonTypes.All || type === DocDockConstants.SkeletonTypes.Guide) {
            this.generateGuide(template, sourcePath, guideDir, configDir, strategy);
        }
    }

    /**
     * ソースパスおよび定義ディレクトリに基づくスケルトン出力先パスの導出
     */
    private static resolveSkeletonTargetFile(
        sourcePath: string,
        targetDir: string,
        suffixYml: string,
        suffixYaml: string,
        configDir: string
    ): string {
        // 既存定義ファイルの優先探索
        const existingFile = DefinitionLoader.findDefinitionFile(
            sourcePath,
            targetDir,
            [suffixYml, suffixYaml],
            configDir
        );
        if (existingFile) {
            return existingFile;
        }

        const templateBaseName = path.basename(sourcePath, path.extname(sourcePath));
        const normalizedSource = path.isAbsolute(sourcePath) ? path.relative(configDir, sourcePath) : sourcePath;
        const relativeSubDir = path.dirname(normalizedSource).replace(/\\/g, '/');

        let subPath = '';
        if (relativeSubDir && relativeSubDir !== '.' && relativeSubDir !== '') {
            const subSegments = relativeSubDir.split('/');
            if (subSegments.length > 1) {
                subPath = subSegments.slice(1).join('/');
            }
        }

        const targetParentDir = subPath ? path.join(targetDir, subPath) : targetDir;
        return path.join(targetParentDir, `${templateBaseName}${suffixYml}`);
    }

    private static generateFlatSkeleton(
        template: any,
        sourcePath: string,
        targetDir: string,
        suffixYml: string,
        suffixYaml: string,
        defaultValue: string | boolean,
        typeName: string,
        configDir: string,
        strategy: any
    ): void {
        const flatKeys = new Set<string>();
        this.extractFlatKeys(template, '', flatKeys, strategy);

        // 出力先パスの解決
        const targetPath = this.resolveSkeletonTargetFile(sourcePath, targetDir, suffixYml, suffixYaml, configDir);
        const targetParentDir = path.dirname(targetPath);
        if (!fs.existsSync(targetParentDir)) {
            fs.mkdirSync(targetParentDir, { recursive: true });
        }

        const formattedDefaultValue = typeof defaultValue === 'string' ? JSON.stringify(defaultValue) : defaultValue;

        if (fs.existsSync(targetPath)) {
            const content = fs.readFileSync(targetPath, 'utf8');
            const schema = strategy && typeof strategy.getSchema === 'function' ? strategy.getSchema() : undefined;
            const doc = (yaml.load(content, { schema }) || {}) as Record<string, any>;
            const existingKeys = new Set<string>();
            for (const existingKey of Object.keys(doc)) {
                // 既存キーの正規化候補展開
                for (const normalizedKey of PathParser.getNormalizedKeys(existingKey)) {
                    // 正規化済みキーの登録
                    existingKeys.add(normalizedKey);
                }
            }

            let appendText = '';
            for (const key of flatKeys) {
                if (!existingKeys.has(key)) {
                    if (typeName === 'exclude' && PathParser.isAncestorExcluded(key, doc)) {
                        continue;
                    }
                    // キーおよび値のエスケープ出力
                    appendText += `${JSON.stringify(key)}: ${formattedDefaultValue}\n`;
                }
            }

            if (appendText) {
                const prefix = content.endsWith('\n') || content === '' ? '' : '\n';
                fs.appendFileSync(targetPath, prefix + appendText);
                Logger.info(`Appended missing keys to ${targetPath}`);
            } else {
                Logger.info(`No missing keys to append for ${targetPath}`);
            }
        } else {
            let newText = '';
            for (const key of flatKeys) {
                // 新規キーおよび値のエスケープ出力
                newText += `${JSON.stringify(key)}: ${formattedDefaultValue}\n`;
            }
            fs.writeFileSync(targetPath, newText);
            Logger.info(`Created skeleton ${typeName}: ${targetPath}`);
        }
    }

    private static generateAlias(
        template: any,
        sourcePath: string,
        aliasDir: string,
        configDir: string,
        strategy: any
    ): void {
        this.generateFlatSkeleton(
            template,
            sourcePath,
            aliasDir,
            DocDockConstants.FileSuffixes.AliasYml,
            DocDockConstants.FileSuffixes.AliasYaml,
            '',
            'alias',
            configDir,
            strategy
        );
    }

    private static generateExclude(
        template: any,
        sourcePath: string,
        excludeDir: string,
        configDir: string,
        strategy: any
    ): void {
        this.generateFlatSkeleton(
            template,
            sourcePath,
            excludeDir,
            DocDockConstants.FileSuffixes.ExcludeYml,
            DocDockConstants.FileSuffixes.ExcludeYaml,
            false,
            'exclude',
            configDir,
            strategy
        );
    }

    private static ensureDirectory(dir: string, typeName: string): void {
        if (!fs.existsSync(dir)) {
            Logger.info(`Creating ${typeName} directory: ${dir}`);
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    private static generateGuide(
        template: any,
        sourcePath: string,
        guideDir: string,
        configDir: string,
        strategy: any
    ): void {
        const skeletonGuide = this.generateGuideSkeleton(template, strategy);

        // 出力先パスの解決
        const targetGuidePath = this.resolveSkeletonTargetFile(
            sourcePath,
            guideDir,
            DocDockConstants.FileSuffixes.GuideYml,
            DocDockConstants.FileSuffixes.GuideYaml,
            configDir
        );
        const targetParentDir = path.dirname(targetGuidePath);
        if (!fs.existsSync(targetParentDir)) {
            fs.mkdirSync(targetParentDir, { recursive: true });
        }

        if (fs.existsSync(targetGuidePath)) {
            const content = fs.readFileSync(targetGuidePath, 'utf8');
            const schema = strategy && typeof strategy.getSchema === 'function' ? strategy.getSchema() : undefined;
            const existingGuide = (schema ? yaml.load(content, { schema }) : yaml.load(content)) || {};
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
            if (prefix) {
                // 配列パスの登録
                keys.add(`${prefix}[]`);
            }
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
                    const idKey = keys.find((k) => ['key', 'name', 'id'].includes(k.toLowerCase())) || keys[0];
                    if (idKey) {
                        const rawVal = item[idKey];
                        // 構造化オブジェクト値のJSONシリアライズ文字列変換
                        const valStr =
                            typeof rawVal === 'object' && rawVal !== null ? JSON.stringify(rawVal) : String(rawVal);
                        const matcherKey = `[${idKey}=${valStr}]`;
                        const guideItem: Record<string, any> = {};
                        guideItem[matcherKey] = '';
                        for (const key of keys) {
                            guideItem[key] = this.generateGuideSkeleton(item[key], strategy);
                        }
                        result.push(guideItem);
                    } else {
                        result.push({});
                    }
                } else if (item !== undefined && item !== null) {
                    const matcherKey = `[${item}]`;
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

        if (Array.isArray(existing) && Array.isArray(skeleton)) {
            const result = [...existing];
            const matchedExistingIndices = new Set<number>();
            for (const skelItem of skeleton) {
                if (typeof skelItem === 'object' && skelItem !== null) {
                    let matchIndex = -1;
                    for (let i = 0; i < existing.length; i++) {
                        // 照合済みでない既存要素との同一性検証
                        if (!matchedExistingIndices.has(i) && this.isMatchingGuideItem(existing[i], skelItem)) {
                            matchIndex = i; // 合致したインデックスの保持
                            break;
                        }
                    }
                    if (matchIndex !== -1) {
                        // 重複照合を防止するためのインデックス登録
                        matchedExistingIndices.add(matchIndex);
                        // 合致した既存ガイド要素に対する再帰マージ処理
                        result[matchIndex] = this.mergeGuides(result[matchIndex], skelItem);
                    } else {
                        // 新規ガイド要素の末尾追加
                        result.push(skelItem);
                    }
                } else {
                    if (!result.includes(skelItem)) {
                        // 重複しない新規スカラー要素の末尾追加
                        result.push(skelItem);
                    }
                }
            }
            return result;
        }

        if (
            typeof existing === 'object' &&
            existing !== null &&
            typeof skeleton === 'object' &&
            skeleton !== null &&
            !Array.isArray(existing) &&
            !Array.isArray(skeleton)
        ) {
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

    // ガイド配列要素同士の同一性判定
    private static isMatchingGuideItem(exItem: any, skelItem: any): boolean {
        // 条件一致判定処理の委譲
        return ConditionEvaluator.areConditionItemsMatching(exItem, skelItem, true);
    }
}
