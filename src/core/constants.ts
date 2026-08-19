export const DocDockConstants = {
    PathSeparator: '__',
    ReservedKeys: {
        Alias: '_alias',
        Match: '_match',
        Imports: '_imports',
        Array: '[]',
        ConditionPrefix: '=',
        DescriptionLower: 'description',
        DescriptionUpper: 'Description',
        ExcludeValue: '__value'
    },
    Defaults: {
        AliasDir: 'aliases',
        ExcludeDir: 'excludes',
        Mode: 'generic',
        Language: 'ja',
        TemplateLayout: '../templates/layout.ejs',
        TemplateIndex: '../templates/index.ejs'
    },
    FileSuffixes: {
        GuideYaml: '.guide.yaml',
        GuideYml: '.guide.yml',
        AliasYaml: '.alias.yaml',
        AliasYml: '.alias.yml',
        ExcludeYaml: '.exclude.yaml',
        ExcludeYml: '.exclude.yml'
    },
    LocalStorageKeys: {
        DocMode: 'doc-mode',
        AliasMode: 'alias-mode',
        CompactMode: 'compact-mode'
    },
    Modes: {
        Inline: 'inline',
        Tooltip: 'tooltip',
        Show: 'show',
        Hide: 'hide'
    },
    CssClasses: {
        IsCollapsed: 'is-collapsed',
        ModeInline: 'mode-inline',
        ModeTooltip: 'mode-tooltip',
        HideDeepAliases: 'hide-deep-aliases',
        CompactMode: 'compact-mode',
        Pinned: 'pinned',
        IsHovered: 'is-hovered',
        Resizing: 'resizing',
        IsResizing: 'is-resizing',
        ResizerHovered: 'resizer-hovered',
        HoverActive: 'hover-active',
        PropertyValue: 'property-value',
        BadgeFn: 'badge-fn',
        TableBase: 'table-base',
        NestedTable: 'nested-table',
        HoverRow: 'hover-row',
        ElemInlineDescWrapper: 'elem-inline-desc-wrapper',
        ElemInlineDesc: 'elem-inline-desc',
        PropertyKeyCell: 'property-key-cell',
        CopyCmdBtn: 'copy-cmd-btn',
        ColResizer: 'col-resizer'
    },
    UIConstants: {
        Resizing: {
            MinColumnWidthPercent: 10,
            MaxColumnWidthPercent: 90,
            MinSidebarWidthPx: 256,
            MaxSidebarWidthRatio: 0.3
        },
        Animation: {
            HighlightDurationMs: 2000,
            TooltipDelayMs: 100,
            CopyFeedbackDurationMs: 1000
        }
    }
} as const;
