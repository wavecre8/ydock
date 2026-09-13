import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { isEqual } from 'lodash';
import { Loader } from './loader';
import { DocDockConfig, PageConfig } from '../types';
import { ModeFactory } from '../modes/factory';
import { DocDockConstants } from './constants';
import { Logger } from './logger';
import { PathUtils } from './path-utils';
import { PathParser, PathToken } from './path-parser';

export type SkeletonType = typeof DocDockConstants.SkeletonTypes[keyof typeof DocDockConstants.SkeletonTypes];

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
        
        const defaultGuideDir = config.guideDir || DocDockConstants.Defaults.GuideDir;
        const defaultAliasDir = config.aliasDir || DocDockConstants.Defaults.AliasDir;
        const defaultExcludeDir = config.excludeDir || DocDockConstants.Defaults.ExcludeDir;

        for (const page of config.pages) {
            // ページ設定に対するグローバルおよびデフォルトディレクトリの補完
            const effectivePage: PageConfig = {
                ...page,
                guideDir: page.guideDir || defaultGuideDir,
                aliasDir: page.aliasDir || defaultAliasDir,
                excludeDir: page.excludeDir || defaultExcludeDir
            };
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
        const templateFileName = path.basename(sourcePath, path.extname(sourcePath));

        if (type === DocDockConstants.SkeletonTypes.All || type === DocDockConstants.SkeletonTypes.Alias) {
            this.generateAlias(template, templateFileName, aliasDir, strategy);
        }
        if (type === DocDockConstants.SkeletonTypes.All || type === DocDockConstants.SkeletonTypes.Exclude) {
            this.generateExclude(template, templateFileName, excludeDir, strategy);
        }
        if (type === DocDockConstants.SkeletonTypes.All || type === DocDockConstants.SkeletonTypes.Guide) {
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

        const formattedDefaultValue = typeof defaultValue === 'string' ? JSON.stringify(defaultValue) : defaultValue;

        if (fs.existsSync(targetPath)) {
            const content = fs.readFileSync(targetPath, 'utf8');
            const doc = (yaml.load(content) || {}) as Record<string, any>;
            const existingKeys = new Set<string>();
            for (const existingKey of Object.keys(doc)) {
                // 既存キーの正規化候補展開
                for (const normalizedKey of this.getNormalizedKeys(existingKey)) {
                    // 正規化済みキーの登録
                    existingKeys.add(normalizedKey);
                }
            }

            let appendText = '';
            for (const key of flatKeys) {
                if (!existingKeys.has(key)) {
                    if (typeName === 'exclude' && this.isAncestorExcluded(key, doc)) {
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

    private static isElementSelector(token: PathToken): boolean {
        return token.type === 'match' || (token.type === 'prop' && /^\d+$/.test(token.name));
    }

    private static tokensToPath(tokens: PathToken[]): string {
        let result = '';
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.type === 'prop') {
                result += (i === 0 ? '' : '.') + token.name;
            } else if (token.type === 'array') {
                result += '[]';
            } else if (token.type === 'match') {
                const valPart = token.value ? `:${token.value}` : '';
                result += `[${token.key}${valPart}]`;
            }
        }
        return result;
    }

    private static getNormalizedKeys(key: string): Set<string> {
        const keys = new Set<string>();
        // 原型キーの登録
        keys.add(key);

        let tokens: PathToken[];
        try {
            // パス文字列の構文解析実行
            tokens = PathParser.parse(key);
        } catch {
            return keys;
        }

        const hasSelector = tokens.some(t => this.isElementSelector(t));
        const endsWithSelectorOrArray = tokens.length > 0 && 
            (this.isElementSelector(tokens[tokens.length - 1]) || tokens[tokens.length - 1].type === 'array');

        // 要素指定を配列指定へ置換したパスの導出
        if (hasSelector) {
            const selectorToArrayTokens: PathToken[] = tokens.map(t => 
                this.isElementSelector(t) ? { type: 'array' } : t
            );
            // 配列置換パスの登録
            keys.add(this.tokensToPath(selectorToArrayTokens));
        }

        // 末尾要素指定の除去による親パスの導出
        if (endsWithSelectorOrArray && tokens.length > 1) {
            const strippedTokens: PathToken[] = tokens.slice(0, tokens.length - 1).map(t => 
                this.isElementSelector(t) ? { type: 'array' } : t
            );
            // 親パスの登録
            keys.add(this.tokensToPath(strippedTokens));
        }

        // 単一プロパティ名と末尾指定で構成される場合の基底プロパティ名導出
        if (tokens.length === 2 && tokens[0].type === 'prop' && (this.isElementSelector(tokens[1]) || tokens[1].type === 'array')) {
            // 基底プロパティ名の登録
            keys.add(tokens[0].name);
        }

        return keys;
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

    // ガイド配列要素同士の同一性判定
    private static isMatchingGuideItem(exItem: any, skelItem: any): boolean {
        if (typeof exItem !== 'object' || exItem === null || typeof skelItem !== 'object' || skelItem === null) {
            return false;
        }

        const skelConditionKeys = Object.keys(skelItem).filter(k => k.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix));
        const exConditionKeys = Object.keys(exItem).filter(k => k.startsWith(DocDockConstants.ReservedKeys.ConditionPrefix));

        // 条件キー総数の完全一致検証
        if (skelConditionKeys.length !== exConditionKeys.length) {
            return false;
        }

        // 条件プレフィックス付きキーに基づく合致判定
        if (skelConditionKeys.length > 0) {
            return skelConditionKeys.every(cKey => {
                if (!(cKey in exItem)) return false;
                const skelVal = skelItem[cKey];
                const exVal = exItem[cKey];

                // スケルトン側の空値プレースホルダーに対するキー存在合致判定
                if (skelVal === '') {
                    return true;
                }

                // スカラー要素マッチャーにおけるキー合致判定
                const skelKeys = Object.keys(skelItem);
                const exKeys = Object.keys(exItem);
                if (skelKeys.length === 1 && exKeys.length === 1 && skelKeys[0] === cKey && exKeys[0] === cKey) {
                    return true;
                }

                // 構造化条件値に対する深い等価比較判定
                if (typeof skelVal === 'object' && skelVal !== null && typeof exVal === 'object' && exVal !== null) {
                    return isEqual(skelVal, exVal);
                }

                // スカラー条件値の完全一致比較
                return skelVal === exVal;
            });
        }

        // 条件キーが存在しないオブジェクト配列要素のキー構造一致判定
        if (exConditionKeys.length === 0) {
            const skelKeys = Object.keys(skelItem);
            const exKeys = Object.keys(exItem);
            if (skelKeys.length > 0 && skelKeys.length === exKeys.length) {
                return skelKeys.every(k => k in exItem);
            }
        }

        return false;
    }
}
