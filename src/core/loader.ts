import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { DocDockConfig, YamlTemplate } from '../types';

export class Loader {
    static loadConfig(configPath: string): DocDockConfig {
        const absolutePath = path.resolve(configPath);
        const content = fs.readFileSync(absolutePath, 'utf8');
        // 空ファイル読み込み時の空オブジェクトフォールバック
        const loaded = yaml.load(content);
        return (loaded && typeof loaded === 'object' ? loaded : {}) as DocDockConfig;
    }

    static loadTemplate(templatePath: string, schema: yaml.Schema = yaml.DEFAULT_SCHEMA): YamlTemplate {
        const absolutePath = path.resolve(templatePath);
        const content = fs.readFileSync(absolutePath, 'utf8');
        if (templatePath.endsWith('.json')) {
            const trimmed = content.trim();
            return trimmed ? JSON.parse(trimmed) : {};
        }
        // 空ファイル読み込み時の空オブジェクトフォールバック
        const loaded = yaml.load(content, { schema });
        return (loaded && typeof loaded === 'object' ? loaded : {}) as YamlTemplate;
    }
}
