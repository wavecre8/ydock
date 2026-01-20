/*
 * YamlDocDock - Client-side Interactivity
 *
 * このファイルは以下のセクションで構成されています：
 * 1. Constants & Utilities
 * 2. Navigation & Collapse
 * 3. Clipboard Operations
 * 4. Deep Linking
 * 5. Display Mode Management
 * 6. Tooltip Management (DOMContentLoaded内で初期化)
 * 7. Column Resizing (DOMContentLoaded内で初期化)
 * 8. Sidebar Resizing (DOMContentLoaded内で初期化)
 */

// ============================================================================
// 1. CONSTANTS & UTILITIES
// ============================================================================

// Access injected constants
const C = window.DocDockConstants;

// Helper: Toggle class on multiple selectors
function toggleClassOnSelectors(selectors, className, shouldAdd) {
    selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((el) => {
            el.classList[shouldAdd ? 'add' : 'remove'](className);
        });
    });
}

// Helper: Toggle class on element by ID
function toggleClassById(elementId, className) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.toggle(className);
    }
    return element;
}

// ============================================================================
// 2. NAVIGATION & COLLAPSE
// ============================================================================

// Collapsible functionality
function toggleSection(contentId, iconId) {
    const content = toggleClassById(contentId, C.CssClasses.IsCollapsed);
    toggleClassById(iconId, C.CssClasses.IsCollapsed);

    if (content && contentId.startsWith('card-')) {
        const cardContainer = content.closest('.card-container');
        if (cardContainer) {
            cardContainer.classList.toggle(C.CssClasses.IsCollapsed);
        }
    }
}

const COLLAPSIBLE_SELECTORS = ['.collapsible-wrapper', '.rotate-icon', '.card-container'];

function expandAll() {
    toggleClassOnSelectors(COLLAPSIBLE_SELECTORS, C.CssClasses.IsCollapsed, false);
}

function collapseAll() {
    toggleClassOnSelectors(COLLAPSIBLE_SELECTORS, C.CssClasses.IsCollapsed, true);
}

// Expand specific section and card when sidebar link is clicked
function expandItem(sectionIndex, cardIndex) {
    const elements = [
        { id: `section-${sectionIndex}-content`, isContent: false },
        { id: `section-${sectionIndex}-content-icon`, isContent: false },
        { id: `card-${sectionIndex}-${cardIndex}-content`, isContent: true },
        { id: `card-${sectionIndex}-${cardIndex}-content-icon`, isContent: false }
    ];

    elements.forEach(({ id, isContent }) => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.remove(C.CssClasses.IsCollapsed);
            if (isContent) {
                const cardContainer = element.closest('.card-container');
                if (cardContainer) cardContainer.classList.remove(C.CssClasses.IsCollapsed);
            }
        }
    });
}

// Navigate to item without using URL fragment
function navigateToItem(itemId, sectionIndex, cardIndex) {
    expandItem(sectionIndex, cardIndex);
    document.getElementById(itemId).scrollIntoView({ behavior: 'smooth' });
}

// Helper for sidebar clicks to avoid EJS syntax errors in inline onclick
function onSidebarItemClick(btn) {
    navigateToItem(btn.dataset.itemId, btn.dataset.sectionIndex, btn.dataset.cardIndex);
}

// ============================================================================
// 3. CLIPBOARD OPERATIONS
// ============================================================================

// Copy raw path to clipboard (for Link Copy Button)
function copyToClipboard(text, btnElement, event) {
    event.stopPropagation();

    navigator.clipboard.writeText(text).then(() => {
        const original = btnElement.innerHTML;
        btnElement.innerHTML =
            '<svg class="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
        btnElement.classList.add('bg-green-50');

        setTimeout(() => {
            btnElement.innerHTML = original;
            btnElement.classList.remove('bg-green-50');
        }, C.UIConstants.Animation.CopyFeedbackDurationMs);
    });
}

// ============================================================================
// 4. DEEP LINKING
// ============================================================================

// Handle deep linking navigation (auto-expand and scroll)
function handleNavigation(targetId) {
    if (!targetId) {
        const hash = window.location.hash.substring(1);
        if (!hash) return;
        targetId = hash;
    }

    const element = document.getElementById(targetId);
    if (!element) return;

    const parts = targetId.split('__');

    if (parts[0] === 'section') {
        const sectionIndex = parts[1];
        const sectionContent = document.getElementById(`section-${sectionIndex}-content`);
        const sectionIcon = document.getElementById(`section-${sectionIndex}-content-icon`);
        if (sectionContent) sectionContent.classList.remove(C.CssClasses.IsCollapsed);
        if (sectionIcon) sectionIcon.classList.remove(C.CssClasses.IsCollapsed);
    }

    if (parts[0] === 'card') {
        const sectionIndex = parts[1];
        const cardIndex = parts[2];

        const sectionContent = document.getElementById(`section-${sectionIndex}-content`);
        const sectionIcon = document.getElementById(`section-${sectionIndex}-content-icon`);
        if (sectionContent) sectionContent.classList.remove(C.CssClasses.IsCollapsed);
        if (sectionIcon) sectionIcon.classList.remove(C.CssClasses.IsCollapsed);

        const cardContent = document.getElementById(`card-${sectionIndex}-${cardIndex}-content`);
        const cardIcon = document.getElementById(`card-${sectionIndex}-${cardIndex}-content-icon`);
        if (cardContent) cardContent.classList.remove(C.CssClasses.IsCollapsed);
        if (cardIcon) cardIcon.classList.remove(C.CssClasses.IsCollapsed);

        if (cardContent) {
            const cardContainer = cardContent.closest('.card-container');
            if (cardContainer) cardContainer.classList.remove(C.CssClasses.IsCollapsed);
        }
    }

    setTimeout(() => {
        if (element) {
            const highlightColor = 'bg-blue-100';
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add(highlightColor);
            setTimeout(() => element.classList.remove(highlightColor), C.UIConstants.Animation.HighlightDurationMs);
        }
    }, C.UIConstants.Animation.TooltipDelayMs);
}

// Event listeners for deep linking
window.addEventListener('DOMContentLoaded', () => handleNavigation());
window.addEventListener('hashchange', () => handleNavigation());

// Intercept internal hash links to scroll without changing URL
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link) {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
            e.preventDefault();
            handleNavigation(href.substring(1));
        }
    }
});

// ============================================================================
// 5. DISPLAY MODE MANAGEMENT
// ============================================================================

// Global functions for onclick handlers
function setMode(mode) {
    if (mode === C.Modes.Inline) {
        document.body.classList.remove(C.CssClasses.ModeTooltip);
        document.body.classList.add(C.CssClasses.ModeInline);
    } else if (mode === C.Modes.Tooltip) {
        document.body.classList.remove(C.CssClasses.ModeInline);
        document.body.classList.add(C.CssClasses.ModeTooltip);
    }
    localStorage.setItem(C.LocalStorageKeys.DocMode, mode);
}

function toggleAliasSwitch(checkbox) {
    const isChecked = checkbox.checked;
    if (!isChecked) {
        document.body.classList.add(C.CssClasses.HideDeepAliases);
        localStorage.setItem(C.LocalStorageKeys.AliasMode, C.Modes.Hide);
    } else {
        document.body.classList.remove(C.CssClasses.HideDeepAliases);
        localStorage.setItem(C.LocalStorageKeys.AliasMode, C.Modes.Show);
    }
}

// ============================================================================
// 6. TOOLTIP MANAGEMENT
// ============================================================================

// Initialize and Setup Handlers
document.addEventListener('DOMContentLoaded', () => {
    // Init Mode
    const savedMode = localStorage.getItem(C.LocalStorageKeys.DocMode) || C.Modes.Inline;
    setMode(savedMode);

    // Init Alias Mode
    const savedAliasMode = localStorage.getItem(C.LocalStorageKeys.AliasMode) || C.Modes.Show;
    const checkbox = document.getElementById('alias-display-toggle');
    if (savedAliasMode === C.Modes.Hide) {
        document.body.classList.add(C.CssClasses.HideDeepAliases);
        if (checkbox) checkbox.checked = false;
    } else {
        document.body.classList.remove(C.CssClasses.HideDeepAliases);
        if (checkbox) checkbox.checked = true;
    }

    // Tooltip Logic Variables
    let currentPinnedTooltip = null;
    let currentPinnedRow = null;

    function toggleTooltipPin(tooltipElement, row) {
        if (currentPinnedTooltip === tooltipElement) {
            tooltipElement.classList.remove(C.CssClasses.Pinned);
            currentPinnedTooltip = null;
            currentPinnedRow = null;
        } else {
            if (currentPinnedTooltip) {
                currentPinnedTooltip.classList.remove(C.CssClasses.Pinned);
            }
            tooltipElement.classList.add(C.CssClasses.Pinned);
            currentPinnedTooltip = tooltipElement;
            currentPinnedRow = row;
        }
    }

    document.body.addEventListener('click', function (e) {
        if (
            e.target.closest('a') ||
            e.target.closest('button') ||
            e.target.closest('input') ||
            e.target.closest('.col-resizer')
        ) {
            return;
        }

        const row = e.target.closest('.hover-row') || e.target.closest('.property-row-div');
        if (row) {
            let container = null;

            if (row.tagName === 'TR') {
                const tds = row.querySelectorAll(':scope > td');
                for (let td of tds) {
                    const directChild = td.querySelector('.tooltip-container');
                    if (directChild) {
                        container = directChild;
                        break;
                    }
                }
            }

            if (container) {
                toggleTooltipPin(container, row);
                return;
            }
        }

        if (currentPinnedTooltip) {
            if (!currentPinnedTooltip.contains(e.target) && !currentPinnedRow.contains(e.target)) {
                currentPinnedTooltip.classList.remove(C.CssClasses.Pinned);
                currentPinnedTooltip = null;
                currentPinnedRow = null;
            }
        }
    });

    // ========================================================================
    // 7. COLUMN RESIZING
    // ========================================================================

    let isResizing = false;
    let currentLevel = null;
    let startX = 0;
    let startWidth = 0;
    let tableWidth = 0;

    document.body.addEventListener('mousedown', (e) => {
        const resizer = e.target.closest('.col-resizer');
        if (!resizer) return;

        isResizing = true;
        currentLevel = resizer.dataset.level;
        startX = e.pageX;

        const th = resizer.closest('th');
        const table = resizer.closest('table');
        tableWidth = table.getBoundingClientRect().width;
        startWidth = th.getBoundingClientRect().width;

        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        resizer.classList.add(C.CssClasses.Resizing);
    });

    document.documentElement.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const diff = e.pageX - startX;
        const newWidthPx = startWidth + diff;

        let newWidthPercent = (newWidthPx / tableWidth) * 100;

        if (
            newWidthPercent <= C.UIConstants.Resizing.MinColumnWidthPercent ||
            newWidthPercent >= C.UIConstants.Resizing.MaxColumnWidthPercent
        ) {
            document.body.style.cursor = 'default';
        } else {
            document.body.style.cursor = 'ew-resize';
        }

        newWidthPercent = Math.max(
            C.UIConstants.Resizing.MinColumnWidthPercent,
            Math.min(C.UIConstants.Resizing.MaxColumnWidthPercent, newWidthPercent)
        );

        const varName = currentLevel !== null ? `--col-width-level-${currentLevel}` : '--col-width-level-default';
        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(() => {
                document.documentElement.style.setProperty(varName, `${newWidthPercent}%`);
                updateResizerHeights();
            });
        } else {
            document.documentElement.style.setProperty(varName, `${newWidthPercent}%`);
            updateResizerHeights();
        }
    });

    document.documentElement.addEventListener('mouseup', () => {
        if (!isResizing) return;

        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        document.querySelectorAll('.col-resizer').forEach((r) => {
            r.classList.remove(C.CssClasses.Resizing);
        });

        currentLevel = null;
    });

    // Update resizer heights to match table heights
    function updateResizerHeights() {
        document.querySelectorAll('.col-resizer').forEach((resizer) => {
            const th = resizer.closest('th');
            if (th) {
                const table = th.closest('table');
                if (table) {
                    resizer.style.height = `${table.offsetHeight}px`;
                }
            }
        });
    }

    window.addEventListener('resize', updateResizerHeights);
    setTimeout(updateResizerHeights, 100);

    // 行ホバー効果（コピーボタン表示用）
    document.body.addEventListener('mouseover', (e) => {
        const row = e.target.closest('.hover-row');
        if (row) {
            row.classList.add(C.CssClasses.IsHovered);
        }
    });

    document.body.addEventListener('mouseout', (e) => {
        const row = e.target.closest('.hover-row');
        if (row) {
            row.classList.remove(C.CssClasses.IsHovered);
        }
    });

    // ========================================================================
    // 8. SIDEBAR RESIZING
    // ========================================================================

    const sidebar = document.getElementById('sidebar');
    const sidebarResizer = document.getElementById('sidebar-resizer');

    if (sidebar && sidebarResizer) {
        let isSidebarResizing = false;
        let sidebarStartX = 0;
        let sidebarStartWidth = 0;

        sidebarResizer.addEventListener('mousedown', (e) => {
            isSidebarResizing = true;
            sidebarStartX = e.pageX;
            sidebarStartWidth = sidebar.getBoundingClientRect().width;

            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
            sidebarResizer.classList.add(C.CssClasses.IsResizing);
        });

        document.addEventListener('mousemove', (e) => {
            if (!isSidebarResizing) return;

            const diff = e.pageX - sidebarStartX;
            const newWidth = sidebarStartWidth + diff;

            const minWidth = C.UIConstants.Resizing.MinSidebarWidthPx;
            const maxWidth = window.innerWidth * C.UIConstants.Resizing.MaxSidebarWidthRatio;

            const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
            sidebar.style.width = `${clampedWidth}px`;
        });

        document.addEventListener('mouseup', () => {
            if (!isSidebarResizing) return;

            isSidebarResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            sidebarResizer.classList.remove(C.CssClasses.IsResizing);
        });
    }
});
