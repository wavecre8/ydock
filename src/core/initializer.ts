import * as fs from 'fs';
import * as path from 'path';

export class Initializer {
    static async init(): Promise<void> {
        const configFileName = 'setting.config.yml';
        const configPath = path.resolve(process.cwd(), configFileName);
        const altConfigPath = path.resolve(process.cwd(), 'setting.config.yaml');

        if (fs.existsSync(configPath) || fs.existsSync(altConfigPath)) {
            console.log('setting.config.yml (or .yaml) already exists.');
            return;
        }

        const defaultConfig = `lang: en

index:
  output: output/index.html
  title: Documentation Portal

pages:
  - title: Sample Documentation
    mode: generic
    sources:
      - src/my-data.yml
    output: output/index.html
    guideDir: guides
    aliasDir: aliases
`;

        fs.writeFileSync(configPath, defaultConfig);
        console.log(`Generated ${configFileName}`);
    }
}
