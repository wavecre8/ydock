export interface DocDockConfig {
    pages: PageConfig[];
    mode?: string;
    lang?: string;
    index?: string | IndexConfig;
    guideDir?: string;
    aliasDir?: string;
    excludeDir?: string;
}

export interface IndexGroupConfig {
    id?: string;
    name: string;
}

export interface IndexConfig {
    output: string;
    title?: string;
    groups?: IndexGroupConfig[];
}

export interface PageConfig {
    title: string;
    sources: string[];
    output: string;
    mode?: string;
    group?: string;
    guideDir?: string;
    aliasDir?: string;
    excludeDir?: string;
    // Legacy support
    templates?: string[];
}

export interface IndexPageItem {
    title: string;
    filename: string;
    link: string;
    mode: string;
    group?: string;
}

export interface IndexGroupItem {
    name: string;
    pages: IndexPageItem[];
}

export type YamlValue = string | number | boolean | null | undefined | YamlValue[] | { [key: string]: YamlValue };

export interface YamlTemplate {
    [key: string]: YamlValue;
}

export type TemplateData = YamlTemplate;
export type GuideData = Record<string, YamlValue>;
export type ExcludeTree = Record<string, any>;

export interface GuideMeta {
    description?: string;
    alias?: string;
}

// 単一ソースファイルの構造およびメタデータ
export interface SingleDocument {
    sourcePath?: string;
    sourceBaseName?: string;
    template: TemplateData;
    description?: GuideData;
    excludeTree?: ExcludeTree;
}

// 構造と意味論の統合ドキュメントモデル
export interface DocDockDocument {
    template: TemplateData;
    description?: GuideData;
    excludeTree?: ExcludeTree;
    mode?: string;
    sourcePath?: string;
    sourceBaseName?: string;
    documents?: SingleDocument[];
}
