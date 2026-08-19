#!/usr/bin/env node
import { Command } from 'commander';
import { Commands } from './core/commands';
import packageJson from '../package.json';

const program = new Command();

program
    .name('ydock')
    .description('Generate human-readable documentation from YAML files')
    .version(packageJson.version);

program
    .command('init')
    .description('Generate a default setting.config.yml')
    .action(async () => {
        await Commands.init();
    });

program
    .command('build')
    .description('Build documentation from setting.config')
    .option('-c, --config <path>', 'Path to setting.config')
    .option('-w, --watch', 'Watch for changes and rebuild automatically')
    .option('--no-open', 'Do not open browser automatically in watch mode')
    .action(async (options) => {
        await Commands.build(options);
    });

program
    .command('skeleton')
    .description('Generate skeleton files (alias, guide, exclude) based on setting.config')
    .option('-c, --config <path>', 'Path to setting.config')
    .option('-t, --type <type>', 'Generate skeleton type: alias, guide, exclude, all', 'all')
    .action(async (options) => {
        await Commands.skeleton(options);
    });

program.parse(process.argv);
