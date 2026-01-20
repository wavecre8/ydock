#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

const packageJson = require('../package.json');

program
    .name('yamldocdock')
    .description('Generate human-readable documentation from YAML files')
    .version(packageJson.version);

program
    .command('init')
    .description('Generate a default setting.config.yml')
    .action(async () => {
        const { Initializer } = await import('./core/initializer');
        await Initializer.init();
    });

program
    .command('build')
    .description('Build documentation from setting.config')
    .option('-c, --config <path>', 'Path to setting.config')
    .option('-w, --watch', 'Watch for changes and rebuild automatically')
    .option('--no-open', 'Do not open browser automatically in watch mode')
    .action(async (options) => {
        try {
            let configPath = options.config;

            if (!configPath) {
                if (require('fs').existsSync('setting.config.yaml')) {
                    configPath = 'setting.config.yaml';
                } else if (require('fs').existsSync('setting.config.yml')) {
                    configPath = 'setting.config.yml';
                } else {
                    configPath = 'setting.config.yaml';
                }
            }

            if (options.watch) {
                const { Watcher } = await import('./core/watcher');
                await Watcher.start({ configPath, open: options.open });
            } else {
                const { DocDockBuilder } = await import('./core/builder');
                await DocDockBuilder.build({ configPath });
            }
        } catch (e) {
            console.error('Build failed:', e);
            // Exit with error if not in watch mode
            if (!options.watch) {
                process.exit(1);
            }
        }
    });

program.parse(process.argv);
