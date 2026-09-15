import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { DocDockConstants } from './constants';
import { GuideData, ExcludeTree, YamlValue } from '../types';
import { ImportResolver } from './import-resolver';
import { PathTreeExpander } from './path-tree-expander';
import { PathUtils } from './path-utils';
import { Logger } from './logger';

export class DefinitionLoader {
    /**
     * ソース識別子に応じた定義ファイルの優先探索
     */
    static findDefinitionFile(
        sourceIdentifier: string,
        resolvedDir: string,
        extensions: string[],
        baseRootDir?: string
    ): string | null {
        const baseName = path.basename(sourceIdentifier, path.extname(sourceIdentifier));
        let normalizedSource = sourceIdentifier;
        if (baseRootDir && path.isAbsolute(normalizedSource)) {
            normalizedSource = path.relative(baseRootDir, normalizedSource);
        }
        const relativeSubDir = path.dirname(normalizedSource).replace(/\\/g, '/');

        // ソースファイルの相対階層を維持したパスの優先探索
        if (relativeSubDir && relativeSubDir !== '.' && relativeSubDir !== '' && !path.isAbsolute(relativeSubDir)) {
            // 相対階層そのままによる探索
            const nestedDir = PathUtils.resolveRelative(resolvedDir, relativeSubDir);
            const nestedCandidate = PathUtils.findFileWithExtensions(nestedDir, baseName, extensions);
            if (nestedCandidate) {
                return nestedCandidate;
            }

            // 先頭ディレクトリを除去した相対階層による探索
            const subSegments = relativeSubDir.split('/');
            if (subSegments.length > 1) {
                const strippedSubDir = subSegments.slice(1).join('/');
                const strippedDir = PathUtils.resolveRelative(resolvedDir, strippedSubDir);
                const strippedCandidate = PathUtils.findFileWithExtensions(strippedDir, baseName, extensions);
                if (strippedCandidate) {
                    return strippedCandidate;
                }
            }
        }

        // 定義ディレクトリ直下のフラットなパスによる探索
        return PathUtils.findFileWithExtensions(resolvedDir, baseName, extensions);
    }

    /**
     * 定義ファイルを読み込みインポートを解決した生データの取得
     */
    static loadRawWithImports(filePath: string, baseDir: string = path.dirname(filePath)): any {
        // ファイル存在確認
        if (!fs.existsSync(filePath)) {
            return {};
        }

        // ファイル内容の読み込み
        const content = fs.readFileSync(filePath, 'utf8');
        // YAML解析の実行
        const parsedData: any = yaml.load(content) || {};

        if (Array.isArray(parsedData)) {
            Logger.warn(`Definition file has an array at root level and will be ignored: ${filePath}`);
            return {};
        }

        if (typeof parsedData !== 'object' || parsedData === null) {
            return {};
        }

        // インポートの再帰解決実行
        return ImportResolver.resolve(parsedData, baseDir);
    }

    /**
     * ガイド定義ファイルの探索および読み込み
     */
    static loadGuide(
        sourceIdentifier: string,
        guideDir: string | undefined,
        configPath: string,
        silent?: boolean
    ): GuideData | null {
        if (!guideDir) return null;

        const configDir = path.dirname(configPath);
        // ガイドディレクトリパスの解決
        const resolvedGuideDir = path.resolve(configDir, guideDir);
        const extensions = [DocDockConstants.FileSuffixes.GuideYaml, DocDockConstants.FileSuffixes.GuideYml];
        // 定義ファイルの探索
        const candidate = this.findDefinitionFile(sourceIdentifier, resolvedGuideDir, extensions, configDir);

        if (candidate) {
            if (!silent) {
                // 検出ログの出力
                Logger.info(`  Found guide: ${candidate}`);
            }
            // インポート解決済みガイドデータの取得
            const rawGuide = this.loadRawWithImports(candidate, path.dirname(candidate)) as GuideData;
            return PathTreeExpander.build(rawGuide, DocDockConstants.ReservedKeys.DescriptionUpper) as GuideData;
        }

        return null;
    }

    /**
     * エイリアス定義ファイルの探索および読み込み
     */
    static loadAlias(
        sourceIdentifier: string,
        aliasDir: string | undefined,
        configPath: string,
        silent?: boolean
    ): GuideData | null {
        if (!aliasDir) return null;

        const configDir = path.dirname(configPath);
        // エイリアスディレクトリパスの解決
        const resolvedAliasDir = path.resolve(configDir, aliasDir);
        const extensions = [DocDockConstants.FileSuffixes.AliasYaml, DocDockConstants.FileSuffixes.AliasYml];
        // 定義ファイルの探索
        const candidate = this.findDefinitionFile(sourceIdentifier, resolvedAliasDir, extensions, configDir);

        if (candidate) {
            if (!silent) {
                // 検出ログの出力
                Logger.info(`  Found alias: ${candidate}`);
            }
            // エイリアスデータの処理実行
            return this.processAliasFile(candidate);
        }

        return null;
    }

    /**
     * 単一エイリアスファイルの読み込みとツリー変換
     */
    static processAliasFile(filePath: string): GuideData {
        // インポート解決済みデータの取得
        let aliasData = this.loadRawWithImports(filePath, path.dirname(filePath)) as GuideData;
        // ツリー構造への展開実行
        aliasData = PathTreeExpander.build(aliasData);
        // エイリアスオブジェクト構造への変換実行
        return this.transformToAliasObjects(aliasData) as GuideData;
    }

    /**
     * 除外定義ファイルの探索および読み込み
     */
    static loadExclude(
        sourceIdentifier: string,
        excludeDir: string | undefined,
        configPath: string,
        silent?: boolean
    ): ExcludeTree | null {
        if (!excludeDir) return null;

        const configDir = path.dirname(configPath);
        // 除外ディレクトリパスの解決
        const resolvedExcludeDir = path.resolve(configDir, excludeDir);
        const extensions = [DocDockConstants.FileSuffixes.ExcludeYaml, DocDockConstants.FileSuffixes.ExcludeYml];
        // 定義ファイルの探索
        const candidate = this.findDefinitionFile(sourceIdentifier, resolvedExcludeDir, extensions, configDir);

        if (candidate) {
            if (!silent) {
                // 検出ログの出力
                Logger.info(`  Found exclude: ${candidate}`);
            }
            // 除外データの処理実行
            return this.processExcludeFile(candidate);
        }

        return null;
    }

    /**
     * 単一除外ファイルの読み込みとツリー変換
     */
    static processExcludeFile(filePath: string, baseDir: string = path.dirname(filePath)): ExcludeTree {
        // インポート解決済みデータの取得
        const rawData = this.loadRawWithImports(filePath, baseDir);
        if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
            return {};
        }
        // 除外終端キーによるツリー展開実行
        return PathTreeExpander.build(rawData, DocDockConstants.ReservedKeys.ExcludeValue) as ExcludeTree;
    }

    /**
     * 末端の文字列値をエイリアスオブジェクト形式へ再帰変換
     */
    private static transformToAliasObjects(data: YamlValue): YamlValue {
        if (typeof data === 'string') {
            return { [DocDockConstants.ReservedKeys.Alias]: data };
        }

        if (Array.isArray(data)) {
            return data.map((item) => this.transformToAliasObjects(item));
        }

        if (!data || typeof data !== 'object') {
            return data;
        }

        const result: Record<string, YamlValue> = {};
        const record = data as Record<string, YamlValue>;

        for (const [key, val] of Object.entries(record)) {
            if (key === DocDockConstants.ReservedKeys.Match && Array.isArray(val)) {
                result[key] = val.map((item) => this.transformToAliasObjects(item));
                continue;
            }

            if (key.startsWith('_')) {
                result[key] = val;
                continue;
            }

            if (typeof val !== 'string') {
                result[key] = this.transformToAliasObjects(val);
                continue;
            }

            // 単一キー構成のスカラーマッチャー判定
            const isConditionKey = key.startsWith('[') && key.endsWith(']');
            const hasOnlyOneKey = Object.keys(record).length === 1;

            if (isConditionKey && !hasOnlyOneKey) {
                result[key] = val;
            } else {
                result[key] = { [DocDockConstants.ReservedKeys.Alias]: val };
            }
        }
        return result;
    }
}
