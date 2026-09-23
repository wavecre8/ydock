import * as fs from 'fs';
import * as path from 'path';
import { Loader } from './loader';
import { Merger } from './merger';
import { DefinitionLoader } from './definition-loader';
import { FileNotFoundError } from './errors';
import { PathUtils } from './path-utils';
import { ModeStrategy } from '../modes/types';
import { PageConfig, TemplateData, GuideData, ExcludeTree, SingleDocument } from '../types';

export class SourceProcessor {
    /**
     * 単一ソースファイルを処理してSingleDocumentを生成
     */
    static processSingle(
        sourcePath: string,
        strategy: ModeStrategy,
        page: PageConfig,
        configPath: string,
        silent?: boolean
    ): SingleDocument {
        const configDir = PathUtils.getConfigDir(configPath);
        const resolvedSourcePath = PathUtils.resolveRelative(configDir, sourcePath);

        // ソースファイルの存在確認
        if (!fs.existsSync(resolvedSourcePath)) {
            throw new FileNotFoundError(resolvedSourcePath, 'template load');
        }

        const template = Loader.loadTemplate(resolvedSourcePath, strategy.getSchema()) as TemplateData;
        const sourceBaseName = path.basename(sourcePath, path.extname(sourcePath));

        // ガイド定義の探索と読み込み
        let guide = this.findAndLoadGuide(sourcePath, page.guideDir, configPath, silent) || {};

        // エイリアス定義の探索と読み込み
        const aliasData = this.findAndProcessAlias(sourcePath, page.aliasDir, configPath, silent);
        if (aliasData) {
            // ガイドとエイリアスの共通マージ実行
            guide = Merger.mergeDescriptions([guide, aliasData], Merger.guideCustomizer);
        }

        // 除外定義の探索と読み込み
        const excludeTree = this.findAndProcessExclude(sourcePath, page.excludeDir, configPath, silent) || {};

        return {
            sourcePath,
            sourceBaseName,
            template,
            description: guide,
            excludeTree
        };
    }

    /**
     * 定義ファイルの探索処理
     */
    private static findDefinitionFile(
        sourceIdentifier: string,
        resolvedDir: string,
        extensions: string[]
    ): string | null {
        // 定義ローダーへの探索委譲
        return DefinitionLoader.findDefinitionFile(sourceIdentifier, resolvedDir, extensions);
    }

    /**
     * 除外定義ファイルの探索と読み込み
     */
    private static findAndProcessExclude(
        sourceIdentifier: string,
        excludeDir: string | undefined,
        configPath: string,
        silent?: boolean
    ): ExcludeTree | null {
        // 定義ローダーへの読み込み委譲
        return DefinitionLoader.loadExclude(sourceIdentifier, excludeDir, configPath, silent);
    }

    /**
     * ガイド定義ファイルの探索と読み込み
     */
    private static findAndLoadGuide(
        sourceIdentifier: string,
        guideDir: string | undefined,
        configPath: string,
        silent?: boolean
    ): GuideData | null {
        // 定義ローダーへの読み込み委譲
        return DefinitionLoader.loadGuide(sourceIdentifier, guideDir, configPath, silent);
    }

    /**
     * エイリアス定義ファイルの探索と読み込み
     */
    private static findAndProcessAlias(
        sourceIdentifier: string,
        aliasDir: string | undefined,
        configPath: string,
        silent?: boolean
    ): GuideData | null {
        // 定義ローダーへの読み込み委譲
        return DefinitionLoader.loadAlias(sourceIdentifier, aliasDir, configPath, silent);
    }
}
