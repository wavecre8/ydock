export const DocDockConstants = {
    LocalStorageKeys: {
        DocMode: 'doc-mode',
        AliasMode: 'alias-mode'
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
        Pinned: 'pinned',
        IsHovered: 'is-hovered',
        Resizing: 'resizing',
        IsResizing: 'is-resizing',
        ResizerHovered: 'resizer-hovered',
        HoverActive: 'hover-active'
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
};
