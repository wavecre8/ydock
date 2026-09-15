import * as fs from 'fs';
import * as path from 'path';
import * as ejs from 'ejs';
import { DocDockConfig, PageConfig, IndexPageItem, IndexGroupItem, IndexGroupConfig } from '../types';
import { DocDockConstants } from './constants';
import { Logger } from './logger';
import { PathUtils } from './path-utils';
import { HtmlMinifier } from './html-minifier';

export class IndexBuilder {
    /**
     * Generate index page that lists all documentation pages
     * @param config Full configuration
     * @param configPath Path to the config file
     * @param globalMode Global mode setting
     * @param language Output language
     * @param silent Whether to suppress logs
     */
    static async build(
        config: DocDockConfig,
        configPath: string,
        globalMode: string,
        language: string,
        _silent?: boolean
    ): Promise<void> {
        const indexConfig =
            typeof config.index === 'string' ? { output: config.index, title: undefined } : config.index;

        if (!indexConfig) return;

        const configDir = PathUtils.getConfigDir(configPath);
        const resolvedIndexOutput = PathUtils.resolveRelative(configDir, indexConfig.output);

        Logger.info(`Generating Index Page: ${resolvedIndexOutput}...`);
        const resolvedTemplatePath = path.join(__dirname, DocDockConstants.Defaults.TemplateIndex);

        if (fs.existsSync(resolvedTemplatePath)) {
            const indexDir = path.dirname(resolvedIndexOutput);

            const pagesData: IndexPageItem[] = config.pages.map((page: PageConfig) => {
                const resolvedPageOutput = PathUtils.resolveRelative(configDir, page.output);

                let relativeLink = path.relative(indexDir, resolvedPageOutput);
                relativeLink = relativeLink.split(path.sep).join('/');

                const filename = path.basename(resolvedPageOutput);
                // ページタイトルのトリムおよびフォールバック導出
                const trimmedTitle = typeof page.title === 'string' ? page.title.trim() : '';
                const fallbackTitle = path.basename(resolvedPageOutput, path.extname(resolvedPageOutput));
                const pageTitle = trimmedTitle.length > 0 ? trimmedTitle : fallbackTitle;

                return {
                    title: pageTitle,
                    filename: filename,
                    link: relativeLink,
                    mode: page.mode || globalMode,
                    group: typeof page.group === 'string' ? page.group.trim() : undefined
                };
            });

            // 未分類グループ名の決定
            const uncategorizedName = DocDockConstants.Defaults.UncategorizedGroup;

            // グループ別データ構造の生成
            const { groups, hasGroups } = this.buildGroups(pagesData, indexConfig.groups, uncategorizedName);

            // ポータルタイトルの決定
            const indexTitle =
                indexConfig.title && indexConfig.title.trim().length > 0
                    ? indexConfig.title.trim()
                    : DocDockConstants.Defaults.IndexTitle;

            const indexHtml = await ejs.renderFile(resolvedTemplatePath, {
                pages: pagesData,
                groups: groups,
                hasGroups: hasGroups,
                language: language,
                title: indexTitle,
                constants: DocDockConstants
            });

            if (!fs.existsSync(indexDir)) {
                fs.mkdirSync(indexDir, { recursive: true });
            }

            // 生成インデックスHTMLに対する空白および改行の安全な圧縮処理
            fs.writeFileSync(resolvedIndexOutput, HtmlMinifier.minify(indexHtml), 'utf8');
            Logger.info(`  Preview Index: ${path.resolve(resolvedIndexOutput)}`);
        } else {
            Logger.warn('Index template not found at ' + resolvedTemplatePath);
        }
    }

    /**
     * ページ一覧からグループ別データ構造を構築
     */
    static buildGroups(
        pages: IndexPageItem[],
        configuredGroups: IndexGroupConfig[] | undefined,
        uncategorizedGroupName: string
    ): { groups: IndexGroupItem[]; hasGroups: boolean } {
        // 全ページにおけるグループ指定の有無判定
        const anyPageHasGroup = pages.some((page) => typeof page.group === 'string' && page.group.trim().length > 0);
        const hasConfiguredGroups = Array.isArray(configuredGroups) && configuredGroups.length > 0;
        const hasGroups = anyPageHasGroup || hasConfiguredGroups;

        if (!hasGroups) {
            return {
                groups: [
                    {
                        name: uncategorizedGroupName,
                        pages: pages
                    }
                ],
                hasGroups: false
            };
        }

        // 明示的なグループ設定が存在する場合の整列と集計
        if (hasConfiguredGroups && configuredGroups) {
            const groupMap = new Map<string, IndexGroupItem>();
            const groupList: IndexGroupItem[] = [];

            for (const groupConfig of configuredGroups) {
                const groupName = groupConfig.name.trim();
                const groupItem: IndexGroupItem = {
                    name: groupName,
                    pages: []
                };
                groupList.push(groupItem);

                // グループ識別子および名称双方のキー登録
                if (groupConfig.id && groupConfig.id.trim().length > 0) {
                    const trimmedId = groupConfig.id.trim();
                    groupMap.set(trimmedId.toLowerCase(), groupItem);
                }
                groupMap.set(groupName.toLowerCase(), groupItem);
            }

            const uncategorizedPages: IndexPageItem[] = [];

            for (const page of pages) {
                const targetKey = typeof page.group === 'string' ? page.group.trim() : '';
                if (targetKey.length > 0) {
                    // 小文字統一キーによるグループ照合判定
                    const matchedGroup = groupMap.get(targetKey.toLowerCase());
                    if (matchedGroup) {
                        matchedGroup.pages.push(page);
                    } else {
                        // 設定外のグループ名が指定された場合の動的グループ追加
                        const dynamicGroupItem: IndexGroupItem = {
                            name: targetKey,
                            pages: [page]
                        };
                        groupMap.set(targetKey, dynamicGroupItem);
                        groupMap.set(targetKey.toLowerCase(), dynamicGroupItem);
                        groupList.push(dynamicGroupItem);
                    }
                } else {
                    uncategorizedPages.push(page);
                }
            }

            const resultGroups: IndexGroupItem[] = [];
            for (const group of groupList) {
                // ページが1件以上存在するグループのみを一覧に含める判定
                if (group.pages.length > 0) {
                    resultGroups.push(group);
                }
            }

            // 未分類ページ群の既存同名グループへの合流または新規追加処理
            if (uncategorizedPages.length > 0) {
                const targetLower = uncategorizedGroupName.toLowerCase();
                const existingGroup = resultGroups.find((group) => group.name.toLowerCase() === targetLower);
                if (existingGroup) {
                    existingGroup.pages.push(...uncategorizedPages);
                } else {
                    resultGroups.push({
                        name: uncategorizedGroupName,
                        pages: uncategorizedPages
                    });
                }
            }

            return {
                groups: resultGroups,
                hasGroups: true
            };
        }

        // ページ側のグループ指定に基づく出現順の集計処理
        const orderMap = new Map<string, IndexGroupItem>();
        const uncategorizedPages: IndexPageItem[] = [];

        for (const page of pages) {
            const groupKey = typeof page.group === 'string' ? page.group.trim() : '';
            if (groupKey.length > 0) {
                // 大文字小文字を同一視した正規化キーによる順序管理
                const normalizedKey = groupKey.toLowerCase();
                if (!orderMap.has(normalizedKey)) {
                    orderMap.set(normalizedKey, {
                        name: groupKey,
                        pages: []
                    });
                }
                orderMap.get(normalizedKey)!.pages.push(page);
            } else {
                uncategorizedPages.push(page);
            }
        }

        const resultGroups = Array.from(orderMap.values());
        // 未分類ページ群の既存同名グループへの合流または新規追加処理
        if (uncategorizedPages.length > 0) {
            const targetLower = uncategorizedGroupName.toLowerCase();
            const existingGroup = resultGroups.find((group) => group.name.toLowerCase() === targetLower);
            if (existingGroup) {
                existingGroup.pages.push(...uncategorizedPages);
            } else {
                resultGroups.push({
                    name: uncategorizedGroupName,
                    pages: uncategorizedPages
                });
            }
        }

        return {
            groups: resultGroups,
            hasGroups: true
        };
    }
}
