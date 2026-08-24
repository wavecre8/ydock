import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { DocDockBuilder, BuildOptions } from './builder';
import { Loader } from './loader';
import { Logger } from './logger';

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
            const config = Loader.loadConfig(options.configPath);
            if (config.index && typeof config.index !== 'string' && config.index.output) {
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
            config.pages.forEach((page) => {
                const sources = page.sources || page.templates || [];
                sources.forEach((src) => {
                    const resolvedSrc = path.isAbsolute(src) ? src : path.join(configDir, src);
                    paths.push(resolvedSrc);
                });

                if (page.guideDir) {
                    const guidePath = path.isAbsolute(page.guideDir) ? page.guideDir : path.join(configDir, page.guideDir);
                    paths.push(guidePath);
                }
                if (page.aliasDir) {
                    const aliasPath = path.isAbsolute(page.aliasDir) ? page.aliasDir : path.join(configDir, page.aliasDir);
                    paths.push(aliasPath);
                }
                if (page.excludeDir) {
                    const excludePath = path.isAbsolute(page.excludeDir) ? page.excludeDir : path.join(configDir, page.excludeDir);
                    paths.push(excludePath);
                }
            });
        } catch (e) {
            Logger.warn('Failed to extract watch paths from config:', e);
        }
        return paths.map((p) => path.resolve(p));
    }
}
