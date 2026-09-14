import * as path from 'path';
import { z } from 'zod';
import { DocDockConfig } from '../types';
import { ConfigValidationError } from './errors';
import { PathUtils } from './path-utils';

const nonEmptyString = (message: string) =>
    z.string().refine(val => val.trim().length > 0, message);

const PageConfigSchema = z.object({
    title: z.string().optional(),
    sources: z.array(nonEmptyString('Source path must not be empty')).optional(),
    output: nonEmptyString('Output path must not be empty'),
    mode: z.enum(['cfn', 'generic']).optional(),
    group: z.string().optional(),
    guideDir: nonEmptyString('Guide directory path must not be empty').optional(),
    aliasDir: nonEmptyString('Alias directory path must not be empty').optional(),
    excludeDir: nonEmptyString('Exclude directory path must not be empty').optional(),
    templates: z.array(nonEmptyString('Template path must not be empty')).optional()
});

const IndexGroupConfigSchema = z.object({
    id: nonEmptyString('Group id must not be empty').optional(),
    name: nonEmptyString('Group name must not be empty')
});

const IndexConfigSchema = z.union([
    nonEmptyString('Index output path must not be empty'),
    z.object({
        output: nonEmptyString('Index output path must not be empty'),
        title: z.string().optional(),
        groups: z.array(IndexGroupConfigSchema).optional()
    })
]);

const DocDockConfigSchema = z.object({
    pages: z.array(PageConfigSchema).min(1, 'At least one page must be defined in pages'),
    mode: z.enum(['cfn', 'generic']).optional(),
    lang: z.string().optional(),
    index: IndexConfigSchema.optional(),
    guideDir: nonEmptyString('Guide directory path must not be empty').optional(),
    aliasDir: nonEmptyString('Alias directory path must not be empty').optional(),
    excludeDir: nonEmptyString('Exclude directory path must not be empty').optional()
});

export class ConfigValidator {
    /**
     * 設定オブジェクトのスキーマおよび論理整合性を検証
     */
    static validate(rawConfig: unknown, configPath: string): DocDockConfig {
        // スキーマ構造および型の検証
        const parseResult = DocDockConfigSchema.safeParse(rawConfig);
        if (!parseResult.success) {
            const errorDetails = parseResult.error.issues.map(issue => {
                const pathStr = issue.path.join('.');
                return `${pathStr}: ${issue.message}`;
            });
            throw new ConfigValidationError(
                `Configuration validation failed:\n  ${errorDetails.join('\n  ')}`,
                errorDetails
            );
        }

        const config = parseResult.data as DocDockConfig;
        const configDir = PathUtils.getConfigDir(configPath);

        // グループ定義の識別子および名称の一意性検証
        const groupErrors: string[] = [];
        if (typeof config.index === 'object' && config.index && Array.isArray(config.index.groups)) {
            const keyOwnerMap = new Map<string, { groupIndex: number; field: 'id' | 'name' }>();

            for (let i = 0; i < config.index.groups.length; i++) {
                const groupItem = config.index.groups[i];
                if (groupItem.id && groupItem.id.trim().length > 0) {
                    const normalizedId = groupItem.id.trim().toLowerCase();
                    const existingOwner = keyOwnerMap.get(normalizedId);
                    if (existingOwner && existingOwner.groupIndex !== i) {
                        groupErrors.push(
                            `index.groups[${i}].id '${groupItem.id}' conflicts with index.groups[${existingOwner.groupIndex}].${existingOwner.field}`
                        );
                    } else {
                        keyOwnerMap.set(normalizedId, { groupIndex: i, field: 'id' });
                    }
                }

                const normalizedName = groupItem.name.trim().toLowerCase();
                const existingOwner = keyOwnerMap.get(normalizedName);
                if (existingOwner && existingOwner.groupIndex !== i) {
                    groupErrors.push(
                        `index.groups[${i}].name '${groupItem.name}' conflicts with index.groups[${existingOwner.groupIndex}].${existingOwner.field}`
                    );
                } else {
                    keyOwnerMap.set(normalizedName, { groupIndex: i, field: 'name' });
                }
            }
        }

        // 重複グループ検出時の例外送出
        if (groupErrors.length > 0) {
            throw new ConfigValidationError(
                `Duplicate group definitions detected in configuration:\n  ${groupErrors.join('\n  ')}`,
                groupErrors
            );
        }

        // 出力パスの一意性検証
        const outputMap = new Map<string, number | string>();
        const duplicates: string[] = [];

        // ポータル出力パスの先行登録
        if (config.index) {
            const indexOutput = typeof config.index === 'string' ? config.index : config.index.output;
            const resolvedIndexPath = PathUtils.resolveRelative(configDir, indexOutput);
            const normalizedIndex = path.normalize(resolvedIndexPath).toLowerCase();
            outputMap.set(normalizedIndex, 'index');
        }

        for (let i = 0; i < config.pages.length; i++) {
            const page = config.pages[i];
            const resolvedPath = PathUtils.resolveRelative(configDir, page.output);
            const normalized = path.normalize(resolvedPath).toLowerCase();

            if (outputMap.has(normalized)) {
                const conflictSource = outputMap.get(normalized);
                const conflictTarget = conflictSource === 'index' ? 'index.output' : `pages[${conflictSource}].output`;
                duplicates.push(`pages[${i}].output '${page.output}' conflicts with ${conflictTarget}`);
            } else {
                outputMap.set(normalized, i);
            }
        }

        // 重複出力パス検出時の例外送出
        if (duplicates.length > 0) {
            throw new ConfigValidationError(
                `Duplicate output paths detected in configuration:\n  ${duplicates.join('\n  ')}`,
                duplicates
            );
        }

        return config;
    }
}
