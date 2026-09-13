import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { DocDockBuilder, BuildOptions } from './builder';
import { Loader } from './loader';
import { Logger } from './logger';
import { DocDockConstants } from './constants';

const browserSync = require('browser-sync');

export class Watcher {
    private static bs = browserSync.create();
    private static rebuildTimeout: NodeJS.Timeout;

    static async start(options: BuildOptions & { open?: boolean }) {
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

        this.bs.init(
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
            (err: unknown, bs: any) => {
                if (err) {
                    Logger.error('BrowserSync failed to start:', err);
                    return;
                }
                const urls = bs.options.getIn(['urls', 'local']);
                Logger.info(`Server running at: ${urls}`);
            }
        );

        const watchPaths = this.getWatchPaths(options.configPath);

        const templateDir = path.resolve(__dirname, '../templates');
        if (fs.existsSync(templateDir)) {
            watchPaths.push(templateDir);
        }

        const uniqueWatchPaths = Array.from(new Set(watchPaths));

        const watcher = chokidar.watch(uniqueWatchPaths, {
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 300,
                pollInterval: 100
            }
        });

        watcher.on('all', async (event, filePath) => {
            clearTimeout(this.rebuildTimeout);
            this.rebuildTimeout = setTimeout(async () => {
                if (path.resolve(filePath) === path.resolve(options.configPath)) {
                    Logger.info('Configuration changed. Rebuilding...');
                } else {
                    Logger.info(`File changed: ${filePath}. Rebuilding...`);
                }

                try {
                    await DocDockBuilder.build({ ...options, silent: true });
                    Logger.setSilent(false);
                    Logger.info('Rebuild complete.');
                    this.bs.reload();
                } catch (e) {
                    Logger.setSilent(false);
                    Logger.error('Build failed:', e);
                }
            }, 300);
        });

        process.on('SIGINT', () => {
            watcher.close();
            this.bs.exit();
            process.exit(0);
        });
    }

    private static getWatchPaths(configPath: string): string[] {
        const resolvedConfigPath = path.resolve(configPath);
        const paths = [resolvedConfigPath];
        const configDir = path.dirname(resolvedConfigPath);

        try {
            const config = Loader.loadConfig(configPath);
            const defaultGuideDir = config?.guideDir || DocDockConstants.Defaults.GuideDir;
            const defaultAliasDir = config?.aliasDir || DocDockConstants.Defaults.AliasDir;
            const defaultExcludeDir = config?.excludeDir || DocDockConstants.Defaults.ExcludeDir;

            // ページ設定配列の安全な取得
            const pages = Array.isArray(config?.pages) ? config.pages : [];
            pages.forEach((page) => {
                const sources = page.sources || page.templates || [];
                sources.forEach((src) => {
                    const resolvedSrc = path.isAbsolute(src) ? src : path.join(configDir, src);
                    paths.push(resolvedSrc);
                });

                const guideDir = page.guideDir || defaultGuideDir;
                if (guideDir) {
                    const guidePath = path.isAbsolute(guideDir) ? guideDir : path.join(configDir, guideDir);
                    paths.push(guidePath);
                }
                const aliasDir = page.aliasDir || defaultAliasDir;
                if (aliasDir) {
                    const aliasPath = path.isAbsolute(aliasDir) ? aliasDir : path.join(configDir, aliasDir);
                    paths.push(aliasPath);
                }
                const excludeDir = page.excludeDir || defaultExcludeDir;
                if (excludeDir) {
                    const excludePath = path.isAbsolute(excludeDir) ? excludeDir : path.join(configDir, excludeDir);
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
            const yaml = require('js-yaml');
            const data = yaml.load(content);
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                const imports = data[DocDockConstants.ReservedKeys.Imports];
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
