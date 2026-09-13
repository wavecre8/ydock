export interface DocDockConfig {
    pages: PageConfig[];
    mode?: 'cfn' | 'generic';
    lang?: string;
    index?: string | IndexConfig;
    guideDir?: string;
    aliasDir?: string;
    excludeDir?: string;
}

export interface IndexConfig {
    output: string;
    title?: string;
}

export interface PageConfig {
    title: string;
    sources: string[];
    output: string;
    mode?: 'cfn' | 'generic';
    guideDir?: string;
    aliasDir?: string;
    excludeDir?: string;
    // Legacy support
    templates?: string[];
}

export type YamlValue = string | number | boolean | null | undefined | YamlValue[] | { [key: string]: YamlValue };

export interface YamlTemplate {
    AWSTemplateFormatVersion?: string;
    Description?: string | Array<{ fileName: string; content: string }>;
    Resources?: Record<string, YamlValue>;
    [key: string]: YamlValue;
}

export type TemplateData = YamlTemplate;
export type GuideData = Record<string, YamlValue>;
export type ExcludeTree = Record<string, any>;

export interface GuideMeta {
    description?: string;
    alias?: string;
}

// The Structure + Semantics overlay model
export interface DocDockDocument {
    template: TemplateData;
    description?: GuideData;
    excludeTree?: ExcludeTree;
    mode?: 'cfn' | 'generic';
}
