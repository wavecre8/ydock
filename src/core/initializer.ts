import * as fs from 'fs';
import * as path from 'path';
import { DocDockConstants } from './constants';
import { Logger } from './logger';

export class Initializer {
    static async init(): Promise<void> {
        const configFileName = DocDockConstants.Defaults.ConfigFile;
        const configPath = path.resolve(process.cwd(), configFileName);
        const alreadyExists = DocDockConstants.ConfigFiles.Candidates.some((name) =>
            fs.existsSync(path.resolve(process.cwd(), name))
        );

        if (alreadyExists) {
            Logger.info('setting.config.yml or setting.config.yaml already exists.');
            return;
        }

        const defaultConfig = `lang: en

guideDir: guides
aliasDir: aliases
excludeDir: excludes

index:
  output: output/index.html
  title: Documentation Portal
  groups:
    - id: system
      name: System Architecture
    - id: services
      name: Core Services

pages:
  - title: System Overview
    group: system
    mode: generic
    sources:
      - src/system.yml
    output: output/system.html

  - title: Service Specification
    group: services
    mode: generic
    sources:
      - src/service.yml
    output: output/service.html
`;

        fs.writeFileSync(configPath, defaultConfig);
        Logger.info(`Generated ${configFileName}`);

        // 規定ディレクトリの初期作成処理
        const initialDirs = [
            DocDockConstants.Defaults.GuideDir,
            DocDockConstants.Defaults.AliasDir,
            DocDockConstants.Defaults.ExcludeDir
        ];

        for (const dirName of initialDirs) {
            const dirPath = path.resolve(process.cwd(), dirName);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                Logger.info(`Created directory: ${dirName}`);
            }
        }
    }
}
