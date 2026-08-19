/*
 * ydock
 */

window.YdockUI = window.YdockUI || {};
const C = window.DocDockConstants;

YdockUI.Utils = {
    toggleClassOnSelectors(selectors, className, shouldAdd) {
        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((el) => {
                el.classList[shouldAdd ? 'add' : 'remove'](className);
            });
        });
    },
    toggleClassById(elementId, className) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.toggle(className);
        }
        return element;
    }
};

YdockUI.Navigation = {
    COLLAPSIBLE_SELECTORS: ['.collapsible-wrapper', '.rotate-icon', '.card-container'],
    
    toggleSection(contentId, iconId) {
        const content = YdockUI.Utils.toggleClassById(contentId, C.CssClasses.IsCollapsed);
        YdockUI.Utils.toggleClassById(iconId, C.CssClasses.IsCollapsed);

        if (content && contentId.startsWith('card-')) {
            const cardContainer = content.closest('.card-container');
            if (cardContainer) {
                cardContainer.classList.toggle(C.CssClasses.IsCollapsed);
            }
        }
    },
    
    expandAll() {
        YdockUI.Utils.toggleClassOnSelectors(this.COLLAPSIBLE_SELECTORS, C.CssClasses.IsCollapsed, false);
    },
    
    collapseAll() {
        YdockUI.Utils.toggleClassOnSelectors(this.COLLAPSIBLE_SELECTORS, C.CssClasses.IsCollapsed, true);
        
        document.querySelectorAll('[id^="section-"][id$="-content"]').forEach(el => {
            el.classList.remove(C.CssClasses.IsCollapsed);
        });
        document.querySelectorAll('[id^="section-"][id$="-content-icon"]').forEach(el => {
            el.classList.remove(C.CssClasses.IsCollapsed);
        });
    },
    
    expandItem(sectionIndex, cardIndex) {
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
    },
    
    navigateToItem(itemId, sectionIndex, cardIndex) {
        this.expandItem(sectionIndex, cardIndex);
        document.getElementById(itemId).scrollIntoView({ behavior: 'smooth' });
    },
    
    onSidebarItemClick(btn) {
        this.navigateToItem(btn.dataset.itemId, btn.dataset.sectionIndex, btn.dataset.cardIndex);
    }
};

YdockUI.Clipboard = {
    copyToClipboard(text, btnElement, event) {
        event.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
            const original = btnElement.innerHTML;
            btnElement.innerHTML = '<svg class="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            btnElement.classList.add('bg-green-50');
            setTimeout(() => {
                btnElement.innerHTML = original;
                btnElement.classList.remove('bg-green-50');
            }, C.UIConstants.Animation.CopyFeedbackDurationMs);
        });
    }
};

YdockUI.DeepLink = {
    handleNavigation(targetId) {
        if (!targetId) {
            const hash = window.location.hash.substring(1);
            if (!hash) return;
            targetId = hash;
        }

        const element = document.getElementById(targetId);
        if (!element) return;

        const parts = targetId.split(C.PathSeparator);

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
    },
    
    init() {
        this.handleNavigation();
        window.addEventListener('hashchange', () => this.handleNavigation());
        
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link) {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    this.handleNavigation(href.substring(1));
                }
            }
        });
    }
};

YdockUI.DisplayMode = {
    setMode(mode) {
        if (mode === C.Modes.Inline) {
            document.body.classList.remove(C.CssClasses.ModeTooltip);
            document.body.classList.add(C.CssClasses.ModeInline);
        } else if (mode === C.Modes.Tooltip) {
            document.body.classList.remove(C.CssClasses.ModeInline);
            document.body.classList.add(C.CssClasses.ModeTooltip);
        }
        localStorage.setItem(C.LocalStorageKeys.DocMode, mode);
    },

    toggleAliasSwitch(checkbox) {
        const isChecked = checkbox.checked;
        if (!isChecked) {
            document.body.classList.add(C.CssClasses.HideDeepAliases);
            localStorage.setItem(C.LocalStorageKeys.AliasMode, C.Modes.Hide);
        } else {
            document.body.classList.remove(C.CssClasses.HideDeepAliases);
            localStorage.setItem(C.LocalStorageKeys.AliasMode, C.Modes.Show);
        }
    },

    toggleCompactSwitch(checkbox) {
        const isChecked = checkbox.checked;
        if (isChecked) {
            document.body.classList.add(C.CssClasses.CompactMode);
            localStorage.setItem(C.LocalStorageKeys.CompactMode, 'true');
        } else {
            document.body.classList.remove(C.CssClasses.CompactMode);
            localStorage.setItem(C.LocalStorageKeys.CompactMode, 'false');
        }
    },
    
    init() {
        const savedMode = localStorage.getItem(C.LocalStorageKeys.DocMode) || C.Modes.Inline;
        this.setMode(savedMode);

        const savedAliasMode = localStorage.getItem(C.LocalStorageKeys.AliasMode) || C.Modes.Show;
        const checkbox = document.getElementById('alias-toggle-checkbox');
        if (savedAliasMode === C.Modes.Hide) {
            document.body.classList.add(C.CssClasses.HideDeepAliases);
            if (checkbox) checkbox.checked = false;
        } else {
            document.body.classList.remove(C.CssClasses.HideDeepAliases);
            if (checkbox) checkbox.checked = true;
        }

        const savedCompactMode = localStorage.getItem(C.LocalStorageKeys.CompactMode) || 'false';
        const compactCheckbox = document.getElementById('compact-toggle-checkbox');
        if (savedCompactMode === 'true') {
            document.body.classList.add(C.CssClasses.CompactMode);
            if (compactCheckbox) compactCheckbox.checked = true;
        } else {
            document.body.classList.remove(C.CssClasses.CompactMode);
            if (compactCheckbox) compactCheckbox.checked = false;
        }
    }
};

YdockUI.Tooltip = {
    currentPinnedTooltip: null,
    currentPinnedRow: null,
    
    toggleTooltipPin(tooltipElement, row) {
        if (this.currentPinnedTooltip === tooltipElement) {
            tooltipElement.classList.remove(C.CssClasses.Pinned);
            this.currentPinnedTooltip = null;
            this.currentPinnedRow = null;
        } else {
            if (this.currentPinnedTooltip) {
                this.currentPinnedTooltip.classList.remove(C.CssClasses.Pinned);
            }
            tooltipElement.classList.add(C.CssClasses.Pinned);
            this.currentPinnedTooltip = tooltipElement;
            this.currentPinnedRow = row;
        }
    },
    
    init() {
        document.body.addEventListener('click', (e) => {
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
                    this.toggleTooltipPin(container, row);
                    return;
                }
            }

            if (this.currentPinnedTooltip) {
                if (!this.currentPinnedTooltip.contains(e.target) && !this.currentPinnedRow.contains(e.target)) {
                    this.currentPinnedTooltip.classList.remove(C.CssClasses.Pinned);
                    this.currentPinnedTooltip = null;
                    this.currentPinnedRow = null;
                }
            }
        });
    }
};

YdockUI.ColumnResizer = {
    isResizing: false,
    currentLevel: null,
    startX: 0,
    startWidth: 0,
    tableWidth: 0,

    updateResizerHeights() {
        document.querySelectorAll('.col-resizer').forEach((resizer) => {
            const th = resizer.closest('th');
            if (th) {
                const table = th.closest('table');
                if (table) {
                    resizer.style.height = `${table.offsetHeight}px`;
                }
            }
        });
    },

    init() {
        document.body.addEventListener('mousedown', (e) => {
            const resizer = e.target.closest('.col-resizer');
            if (!resizer) return;

            this.isResizing = true;
            this.currentLevel = resizer.dataset.level;
            this.startX = e.pageX;

            const th = resizer.closest('th');
            const table = resizer.closest('table');
            this.tableWidth = table.getBoundingClientRect().width;
            this.startWidth = th.getBoundingClientRect().width;

            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
            resizer.classList.add(C.CssClasses.IsResizing);
            document.body.classList.add(C.CssClasses.IsResizing);
        });

        document.documentElement.addEventListener('mousemove', (e) => {
            if (!this.isResizing) return;

            const diff = e.pageX - this.startX;
            const newWidthPx = this.startWidth + diff;
            let newWidthPercent = (newWidthPx / this.tableWidth) * 100;

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

            const varName = this.currentLevel !== null ? `--col-width-level-${this.currentLevel}` : '--col-width-level-default';
            if (window.requestAnimationFrame) {
                window.requestAnimationFrame(() => {
                    document.documentElement.style.setProperty(varName, `${newWidthPercent}%`);
                    this.updateResizerHeights();
                });
            } else {
                document.documentElement.style.setProperty(varName, `${newWidthPercent}%`);
                this.updateResizerHeights();
            }
        });

        document.documentElement.addEventListener('mouseup', () => {
            if (!this.isResizing) return;

            this.isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.body.classList.remove(C.CssClasses.IsResizing);

            document.querySelectorAll('.col-resizer').forEach((r) => {
                r.classList.remove(C.CssClasses.IsResizing);
            });

            this.currentLevel = null;
        });

        window.addEventListener('resize', () => this.updateResizerHeights());
        setTimeout(() => this.updateResizerHeights(), 100);

        document.body.addEventListener('mouseover', (e) => {
            const container = e.target.closest('.hover-row, .nested-table');
            if (container && container.classList.contains('hover-row')) {
                container.classList.add(C.CssClasses.IsHovered);
            }
        });

        document.body.addEventListener('mouseout', (e) => {
            const container = e.target.closest('.hover-row, .nested-table');
            if (container && container.classList.contains('hover-row')) {
                container.classList.remove(C.CssClasses.IsHovered);
            }
        });
    }
};

YdockUI.SidebarResizer = {
    init() {
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
    }
};

// Initialize all modules on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    YdockUI.DisplayMode.init();
    YdockUI.DeepLink.init();
    YdockUI.Tooltip.init();
    YdockUI.ColumnResizer.init();
    YdockUI.SidebarResizer.init();
});
