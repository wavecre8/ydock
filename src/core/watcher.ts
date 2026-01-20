import * as chokidar from 'chokidar';
import * as path from 'path';
import { DocDockBuilder, BuildOptions } from './builder';
import { Loader } from './loader';

const browserSync = require('browser-sync');

export class Watcher {
    private static bs = browserSync.create();

    static async start(options: BuildOptions & { open?: boolean }) {
        console.log('Starting watch mode...');

        try {
            await DocDockBuilder.build({ ...options, silent: true });
        } catch (e) {
            console.error('Initial build failed:', e);
        }

        // Determine start page
        let startPath = '';
        try {
            const config = Loader.loadConfig(options.configPath);
            if (config.index && typeof config.index !== 'string' && config.index.output) {
                startPath = config.index.output;
            } else if (config.pages?.[0]?.output) {
                startPath = config.pages[0].output;
            }
        } catch (e) {
            console.warn('Failed to determine start page:', e);
        }

        // Initialize BrowserSync with directory listing enabled
        this.bs.init(
            {
                server: {
                    baseDir: './',
                    directory: true
                },
                startPath: startPath,
                ui: false,
                notify: false,
                open: options.open ?? true,
                logLevel: 'silent'
            },
            (err: unknown, bs: any) => {
                const urls = bs.options.getIn(['urls', 'local']);
                console.log(`Server running at: ${urls}`);
            }
        );

        const watchPaths = this.getWatchPaths(options.configPath);

        // Watch internal templates as well (useful for development of the tool itself)
        const templateDir = path.resolve(__dirname, '../templates');
        watchPaths.push(path.join(templateDir, '**/*.ejs'));

        const watcher = chokidar.watch(watchPaths, {
            ignoreInitial: true,
            // Wait for writes to finish to avoid partial reads
            awaitWriteFinish: {
                stabilityThreshold: 300,
                pollInterval: 100
            }
        });

        watcher.on('all', async (event, filePath) => {
            if (filePath === path.resolve(options.configPath)) {
                console.log('Configuration changed. Rebuilding...');
            }

            try {
                await DocDockBuilder.build({ ...options, silent: true });
                this.bs.reload();
            } catch (e) {
                console.error('Build failed:', e);
            }
        });

        process.on('SIGINT', () => {
            watcher.close();
            this.bs.exit();
            process.exit(0);
        });
    }

    private static getWatchPaths(configPath: string): string[] {
        const paths = [configPath];
        const configDir = path.dirname(path.resolve(configPath));

        try {
            const config = Loader.loadConfig(configPath);
            config.pages.forEach((page) => {
                if (page.sources) {
                    page.sources.forEach((src) => {
                        if (require('fs').existsSync(src)) {
                            paths.push(src);
                        } else {
                            paths.push(path.join(configDir, src));
                        }
                    });
                }
                if (page.templates) {
                    page.templates.forEach((tpl) => {
                        if (require('fs').existsSync(tpl)) {
                            paths.push(tpl);
                        } else {
                            paths.push(path.join(configDir, tpl));
                        }
                    });
                }

                if (page.guideDir) {
                    // Watch the directory directly instead of using globs
                    const guidePath = path.join(configDir, page.guideDir);
                    paths.push(guidePath);
                }
                if (page.aliasDir) {
                    const aliasPath = path.join(configDir, page.aliasDir);
                    paths.push(aliasPath);
                }
            });
        } catch (e) {
            console.warn('Failed to extract watch paths from config:', e);
        }
        return paths.map((p) => path.resolve(p).replace(/\\/g, '/'));
    }
}
