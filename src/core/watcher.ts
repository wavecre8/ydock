import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { DocDockBuilder, BuildOptions } from './builder';
import { Loader } from './loader';
import { Logger } from './logger';
import { DocDockConstants } from './constants';
import { ConfigUtils } from './config-utils';

const browserSync = require('browser-sync');

export class Watcher {
    static async start(options: BuildOptions & { open?: boolean }) {
        const bs = browserSync.create();
        let rebuildTimeout: NodeJS.Timeout;
        let isBuilding = false;
        let pendingRebuild = false;
        let latestFilePath: string = '';
        Logger.info('Starting watch mode...');

        try {
            await DocDockBuilder.build({ ...options, silent: false });
        } catch (e) {
            Logger.error('Initial build failed:', e);
        }

        const configDir = path.dirname(path.resolve(options.configPath));

        let startPath = '';
        try {
            // 設定ファイルの読み込み
            const config = Loader.loadConfig(options.configPath);
            if (typeof config.index === 'string') {
                startPath = config.index;
            } else if (config.index && typeof config.index === 'object' && config.index.output) {
                startPath = config.index.output;
            } else if (config.pages?.[0]?.output) {
                startPath = config.pages[0].output;
            }
        } catch (e) {
            Logger.warn('Failed to determine start page:', e);
        }

        startPath = startPath.replace(/\\/g, '/');

        bs.init(
            {
                server: {
                    baseDir: [configDir, process.cwd()],
                    directory: true
                },
                startPath: startPath,
                ui: false,
                notify: false,
                open: options.open ?? true,
                logLevel: 'silent'
            },
            (err: unknown, bsInstance: any) => {
                if (err) {
                    Logger.error('BrowserSync failed to start:', err);
                    return;
                }
                const urls = bsInstance.options.getIn(['urls', 'local']);
                Logger.info(`Server running at: ${urls}`);
            }
        );

        const watchPaths = this.getWatchPaths(options.configPath);

        const templateDir = path.resolve(__dirname, '../templates');
        if (fs.existsSync(templateDir)) {
            watchPaths.push(templateDir);
        }

        let currentWatchPaths = new Set<string>(watchPaths);

        const watcher = chokidar.watch(Array.from(currentWatchPaths), {
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 300,
                pollInterval: 100
            }
        });

        const executeBuild = async (changedPath: string) => {
            if (isBuilding) {
                pendingRebuild = true;
                latestFilePath = changedPath;
                return;
            }

            isBuilding = true;
            const targetPath = changedPath;

            const isConfigChanged =
                path.resolve(targetPath).toLowerCase() === path.resolve(options.configPath).toLowerCase();
            if (isConfigChanged) {
                Logger.info('Configuration changed. Rebuilding...');
            } else {
                Logger.info(`File changed: ${targetPath}. Rebuilding...`);
            }

            try {
                await DocDockBuilder.build({ ...options, silent: true });
                Logger.setSilent(false);
                Logger.info('Rebuild complete.');
                if (isConfigChanged) {
                    // 最新設定に基づく監視対象パスの再取得および追加
                    const latestWatchPaths = this.getWatchPaths(options.configPath);
                    if (fs.existsSync(templateDir)) {
                        latestWatchPaths.push(templateDir);
                    }
                    const newWatchPathsSet = new Set(latestWatchPaths);

                    // 不要になった古い監視パスの解除
                    const removedPaths = Array.from(currentWatchPaths).filter((p) => !newWatchPathsSet.has(p));
                    if (removedPaths.length > 0) {
                        watcher.unwatch(removedPaths);
                    }

                    // 新規パスの監視追加
                    const addedPaths = Array.from(newWatchPathsSet).filter((p) => !currentWatchPaths.has(p));
                    if (addedPaths.length > 0) {
                        watcher.add(addedPaths);
                    }

                    currentWatchPaths = newWatchPathsSet;
                }
                bs.reload();
            } catch (e) {
                Logger.setSilent(false);
                Logger.error('Build failed:', e);
            } finally {
                isBuilding = false;
                if (pendingRebuild) {
                    pendingRebuild = false;
                    const nextPath = latestFilePath;
                    // 保留中ビルドの即時実行
                    setTimeout(() => executeBuild(nextPath), 0);
                }
            }
        };

        watcher.on('all', async (event, filePath) => {
            clearTimeout(rebuildTimeout);
            latestFilePath = filePath;
            rebuildTimeout = setTimeout(() => {
                executeBuild(latestFilePath);
            }, 300);
        });

        process.on('SIGINT', () => {
            watcher.close();
            bs.exit();
            process.exit(0);
        });
    }

    private static getWatchPaths(configPath: string): string[] {
        const resolvedConfigPath = path.resolve(configPath);
        const paths = [resolvedConfigPath];
        const configDir = path.dirname(resolvedConfigPath);

        try {
            const config = Loader.loadConfig(configPath);
            // 補完済みページ設定一覧の取得
            const effectivePages = ConfigUtils.getEffectivePages(config);
            effectivePages.forEach((page) => {
                const sources = page.sources || page.templates || [];
                sources.forEach((src) => {
                    const resolvedSrc = path.isAbsolute(src) ? src : path.join(configDir, src);
                    paths.push(resolvedSrc);
                });

                if (page.guideDir) {
                    const guidePath = path.isAbsolute(page.guideDir)
                        ? page.guideDir
                        : path.join(configDir, page.guideDir);
                    paths.push(guidePath);
                }
                if (page.aliasDir) {
                    const aliasPath = path.isAbsolute(page.aliasDir)
                        ? page.aliasDir
                        : path.join(configDir, page.aliasDir);
                    paths.push(aliasPath);
                }
                if (page.excludeDir) {
                    const excludePath = path.isAbsolute(page.excludeDir)
                        ? page.excludeDir
                        : path.join(configDir, page.excludeDir);
                    paths.push(excludePath);
                }
            });

            // 外部インポートファイルの再帰的探索
            const importPaths = new Set<string>();
            for (const targetPath of paths) {
                if (fs.existsSync(targetPath)) {
                    this.scanDirectoryForImports(targetPath, importPaths);
                }
            }
            importPaths.forEach((ip) => paths.push(ip));
        } catch (e) {
            Logger.warn('Failed to extract watch paths from config:', e);
        }
        return paths.map((p) => path.resolve(p));
    }

    // インポートファイルの再帰的探索処理
    private static collectImportPaths(filePath: string, collected: Set<string>): void {
        const resolvedPath = path.resolve(filePath);
        if (collected.has(resolvedPath) || !fs.existsSync(resolvedPath)) {
            return;
        }
        collected.add(resolvedPath);

        try {
            const content = fs.readFileSync(resolvedPath, 'utf8');
            const data = yaml.load(content);
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                const imports = (data as Record<string, unknown>)[DocDockConstants.ReservedKeys.Imports];
                if (Array.isArray(imports)) {
                    for (const importItem of imports) {
                        if (typeof importItem === 'string') {
                            const nextPath = path.resolve(path.dirname(resolvedPath), importItem);
                            this.collectImportPaths(nextPath, collected);
                        }
                    }
                }
            }
        } catch {
            // パース失敗時はスキップ
        }
    }

    // ディレクトリ内のYAMLファイルを対象としたインポート探索
    private static scanDirectoryForImports(targetPath: string, collected: Set<string>): void {
        if (!fs.existsSync(targetPath)) return;
        const stat = fs.statSync(targetPath);
        if (!stat.isDirectory()) {
            if (targetPath.endsWith('.yml') || targetPath.endsWith('.yaml')) {
                this.collectImportPaths(targetPath, collected);
            }
            return;
        }

        try {
            const files = fs.readdirSync(targetPath);
            for (const file of files) {
                const fullPath = path.join(targetPath, file);
                const subStat = fs.statSync(fullPath);
                if (subStat.isDirectory()) {
                    this.scanDirectoryForImports(fullPath, collected);
                } else if (file.endsWith('.yml') || file.endsWith('.yaml')) {
                    this.collectImportPaths(fullPath, collected);
                }
            }
        } catch {
            // 読み取り失敗時はスキップ
        }
    }
}
