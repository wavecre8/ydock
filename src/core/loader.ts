import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { DocDockConfig, YamlTemplate } from '../types';

export class Loader {
    static loadConfig(configPath: string): DocDockConfig {
        const absolutePath = path.resolve(configPath);
        const content = fs.readFileSync(absolutePath, 'utf8');
        return yaml.load(content) as DocDockConfig;
    }

    static loadTemplate(templatePath: string, schema: yaml.Schema = yaml.DEFAULT_SCHEMA): YamlTemplate {
        const absolutePath = path.resolve(templatePath);
        const content = fs.readFileSync(absolutePath, 'utf8');
        if (templatePath.endsWith('.json')) {
            return JSON.parse(content);
        }
        return yaml.load(content, { schema }) as YamlTemplate;
    }
}
