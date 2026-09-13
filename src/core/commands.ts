import { DocDockConstants } from './constants';
import { Logger } from './logger';
import { PathUtils } from './path-utils';
import type { SkeletonType } from './skeleton-generator';

export class Commands {
    static async init() {
        const { Initializer } = await import('./initializer');
        await Initializer.init();
    }

    static async build(options: { config?: string; watch?: boolean; open?: boolean }) {
        try {
            let configPath = options.config;

            if (!configPath) {
                configPath = PathUtils.findDefaultConfigPath();
            }

            if (options.watch) {
                const { Watcher } = await import('./watcher');
                await Watcher.start({ configPath, open: options.open !== false });
            } else {
                const { DocDockBuilder } = await import('./builder');
                await DocDockBuilder.build({ configPath });
            }
        } catch (e) {
            Logger.error('Build failed:', e);
            if (!options.watch) {
                process.exit(1);
            }
        }
    }

    static async skeleton(options: { config?: string; type?: string }) {
        try {
            let configPath = options.config;
            const type = (options.type || DocDockConstants.SkeletonTypes.All) as SkeletonType;

            if (!configPath) {
                configPath = PathUtils.findDefaultConfigPath();
            }

            const { SkeletonGenerator } = await import('./skeleton-generator');
            await SkeletonGenerator.generate({ configPath, type });
        } catch (e) {
            Logger.error('Skeleton generation failed:', e);
            process.exit(1);
        }
    }
}
