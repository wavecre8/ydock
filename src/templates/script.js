/*
 * ydock
 */

window.YdockUI = window.YdockUI || {};
const C = window.DocDockConstants;

YdockUI.Utils = {
    // 複合セレクタに該当する全要素のクラス一括切り替え処理
    toggleClassOnSelector(selector, className, shouldAdd) {
        const elements = document.querySelectorAll(selector);
        const action = shouldAdd ? 'add' : 'remove';
        for (let i = 0; i < elements.length; i++) {
            elements[i].classList[action](className);
        }
    },
    // 単一ID要素のクラストグル処理
    toggleClassById(elementId, className) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.toggle(className);
        }
        return element;
    }
};

YdockUI.Navigation = {
    COLLAPSIBLE_SELECTOR: '.collapsible-wrapper, .rotate-icon, .card-container',
    SECTION_HEADER_SELECTOR: '[id^="section-"][id$="-content"], [id^="section-"][id$="-content-icon"]',

    toggleSection(contentId, iconId) {
        const content = YdockUI.Utils.toggleClassById(contentId, C.CssClasses.IsCollapsed);
        YdockUI.Utils.toggleClassById(iconId, C.CssClasses.IsCollapsed);

        if (content && contentId.startsWith('card-')) {
            const cardContainer = content.closest('.card-container');
            if (cardContainer) {
                cardContainer.classList.toggle(C.CssClasses.IsCollapsed);
            }
        }

        if (YdockUI.ColumnResizer && typeof YdockUI.ColumnResizer.updateResizerHeights === 'function') {
            setTimeout(() => {
                YdockUI.ColumnResizer.updateResizerHeights();
            }, 300);
        }
    },

    expandAll() {
        // 全展開時の一時的トランジション無効化設定
        document.body.classList.add('disable-transitions');
        YdockUI.Utils.toggleClassOnSelector(this.COLLAPSIBLE_SELECTOR, C.CssClasses.IsCollapsed, false);
        window.requestAnimationFrame(() => {
            // トランジション無効化の解除処理
            document.body.classList.remove('disable-transitions');
            if (YdockUI.ColumnResizer && typeof YdockUI.ColumnResizer.updateResizerHeights === 'function') {
                YdockUI.ColumnResizer.updateResizerHeights();
            }
        });
    },

    collapseAll() {
        // 全折りたたみ時の一時的トランジション無効化設定
        document.body.classList.add('disable-transitions');
        YdockUI.Utils.toggleClassOnSelector(this.COLLAPSIBLE_SELECTOR, C.CssClasses.IsCollapsed, true);

        // 最上位セクションの展開状態維持処理
        YdockUI.Utils.toggleClassOnSelector(this.SECTION_HEADER_SELECTOR, C.CssClasses.IsCollapsed, false);
        window.requestAnimationFrame(() => {
            // トランジション無効化の解除処理
            document.body.classList.remove('disable-transitions');
            if (YdockUI.ColumnResizer && typeof YdockUI.ColumnResizer.updateResizerHeights === 'function') {
                YdockUI.ColumnResizer.updateResizerHeights();
            }
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

        if (YdockUI.ColumnResizer && typeof YdockUI.ColumnResizer.updateResizerHeights === 'function') {
            setTimeout(() => {
                YdockUI.ColumnResizer.updateResizerHeights();
            }, 300);
        }
    },

    navigateToItem(itemId, sectionIndex, cardIndex) {
        this.expandItem(sectionIndex, cardIndex);
        const element = document.getElementById(itemId);
        // 対象要素が存在する場合のみスクロールを実行
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    },

    onSidebarItemClick(btn) {
        if (btn.dataset.itemId && YdockUI.ScrollSpy) {
            // スクロール追従の一時ロックとアクティブ状態の即時反映
            YdockUI.ScrollSpy.lock(btn.dataset.itemId);
        }
        // 対象要素へのスムーズスクロール実行
        this.navigateToItem(btn.dataset.itemId, btn.dataset.sectionIndex, btn.dataset.cardIndex);
    }
};

YdockUI.Clipboard = {
    // コピー成功時のアイコン演出処理
    showFeedback(btnElement) {
        if (!btnElement) return;
        const original = btnElement.innerHTML;
        btnElement.innerHTML =
            '<svg class="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
        btnElement.classList.add('bg-green-50');
        setTimeout(() => {
            btnElement.innerHTML = original;
            btnElement.classList.remove('bg-green-50');
        }, C.UIConstants.Animation.CopyFeedbackDurationMs);
    },

    // 非セキュア環境向けフォールバックコピー処理
    fallbackCopy(text, btnElement) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful) {
                this.showFeedback(btnElement);
            }
        } catch {
            // フォールバック失敗時は例外を抑止
        }
    },

    copyToClipboard(target, event) {
        if (event) {
            event.stopPropagation();
        }
        let text = '';
        let btnElement = null;

        if (typeof target === 'string') {
            text = target;
            if (event && event.currentTarget) {
                btnElement = event.currentTarget;
            }
        } else if (target && target.getAttribute) {
            btnElement = target;
            text = btnElement.getAttribute('data-copy-path') || '';
        }

        if (!text) return;

        // クリップボードAPI利用可能環境でのコピー実行
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard
                .writeText(text)
                .then(() => {
                    this.showFeedback(btnElement);
                })
                .catch(() => {
                    this.fallbackCopy(text, btnElement);
                });
        } else {
            // 非セキュア環境におけるフォールバックコピーの実行
            this.fallbackCopy(text, btnElement);
        }
    },

    // コピーボタン押下時のイベント委譲リスナー登録
    init() {
        document.body.addEventListener('click', (e) => {
            const btn = e.target.closest(`.${C.CssClasses.CopyCmdBtn}`);
            if (btn) {
                this.copyToClipboard(btn, e);
            }
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

        let element = document.getElementById(targetId);
        if (!element) {
            // 接頭辞付き要素に対するフォールバック探索
            try {
                const escapedTargetId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(targetId) : targetId;
                const prefixMatch = targetId.match(/^(doc_\d+)\.(.*)$/);
                if (prefixMatch) {
                    const docPrefix = prefixMatch[1];
                    const pureTargetId =
                        typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(prefixMatch[2]) : prefixMatch[2];
                    element =
                        document.querySelector(`[id^="${docPrefix}."][id$=".${pureTargetId}"]`) ||
                        document.querySelector(`[id^="${docPrefix}."][id*=".${pureTargetId}."]`) ||
                        document.querySelector(`[id^="${docPrefix}."][id*="${pureTargetId}"]`);
                } else {
                    element =
                        document.querySelector(`[id$=".${escapedTargetId}"]`) ||
                        document.querySelector(`[id*=".${escapedTargetId}"]`);
                }
            } catch {
                // セレクタ構文例外発生時のフォールバック中断抑止
                element = null;
            }
        }
        if (!element) return;

        // 対象要素および祖先ツリーの折りたたみ状態の一括解除
        let current = element;
        while (current && current !== document.body) {
            if (current.classList.contains(C.CssClasses.IsCollapsed)) {
                current.classList.remove(C.CssClasses.IsCollapsed);
            }
            if (current.classList.contains('collapsible-wrapper')) {
                current.classList.remove(C.CssClasses.IsCollapsed);
                const icon = document.getElementById(`${current.id}-icon`);
                if (icon) icon.classList.remove(C.CssClasses.IsCollapsed);
            }
            if (current.classList.contains('card-container')) {
                current.classList.remove(C.CssClasses.IsCollapsed);
                const cardContent = current.querySelector('.collapsible-wrapper');
                if (cardContent) {
                    cardContent.classList.remove(C.CssClasses.IsCollapsed);
                    const icon = document.getElementById(`${cardContent.id}-icon`);
                    if (icon) icon.classList.remove(C.CssClasses.IsCollapsed);
                }
            }
            current = current.parentElement;
        }

        // 対象要素がカードコンテナ自身である場合の内部展開
        if (element.classList.contains('card-container')) {
            const cardContent = element.querySelector('.collapsible-wrapper');
            if (cardContent) {
                cardContent.classList.remove(C.CssClasses.IsCollapsed);
                const icon = document.getElementById(`${cardContent.id}-icon`);
                if (icon) icon.classList.remove(C.CssClasses.IsCollapsed);
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
        checkbox.nextElementSibling.classList.add('after:transition-all');
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
        checkbox.nextElementSibling.classList.add('after:transition-all');
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
                    // 対象行直下のツールチップコンテナのみを検索
                    container = row.querySelector(
                        ':scope > td > div > .tooltip-container, :scope > td > .tooltip-container'
                    );
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

    // 全リサイザーの高さ同期処理
    updateResizerHeights() {
        const resizers = document.querySelectorAll('.col-resizer');
        const updates = [];

        // 読み取り処理
        for (let i = 0; i < resizers.length; i++) {
            const resizer = resizers[i];
            const th = resizer.closest('th');
            if (!th) continue;
            const table = th.closest('table');
            if (!table) continue;

            const height = table.offsetHeight;
            if (height > 0) {
                updates.push({ resizer, height });
            }
        }

        // スタイル適用処理
        for (let i = 0; i < updates.length; i++) {
            updates[i].resizer.style.height = `${updates[i].height}px`;
        }
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

            const varName =
                this.currentLevel !== null ? `--col-width-level-${this.currentLevel}` : '--col-width-level-default';
            // 列幅CSS変数の更新処理
            window.requestAnimationFrame(() => {
                document.documentElement.style.setProperty(varName, `${newWidthPercent}%`);
            });
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
            // リサイズ確定後のリサイザー高さ同期処理
            this.updateResizerHeights();
        });

        window.addEventListener('resize', () => this.updateResizerHeights());
        setTimeout(() => this.updateResizerHeights(), 100);
    }
};

YdockUI.Sidebar = {
    toggle() {
        // サイドバー折りたたみ状態の反転設定
        document.body.classList.toggle(C.CssClasses.SidebarCollapsed);
        setTimeout(() => {
            // アニメーション完了後のテーブルレイアウト再同期
            window.dispatchEvent(new Event('resize'));
        }, 250);
    }
};

YdockUI.ScrollSpy = {
    activeId: null,
    isLocked: false,
    lockTimer: null,
    rafId: null,
    scrollLockHandler: null,
    cards: [],

    // サイドバー項目のアクティブ状態切り替え処理
    setActive(itemId) {
        if (!itemId || this.activeId === itemId) return;
        this.activeId = itemId;

        const activeClass = C.CssClasses.SidebarItemActive;
        const currentActive = document.querySelector(`.${activeClass}`);
        if (currentActive) {
            currentActive.classList.remove(activeClass);
        }

        const targetBtn = document.querySelector(`button[data-item-id="${itemId}"]`);
        if (!targetBtn) return;

        targetBtn.classList.add(activeClass);
        // サイドバー可視範囲外の場合の自動スクロール調整
        targetBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },

    // 手動クリック時のジャンプスクロール追従制御処理
    lock(itemId) {
        this.isLocked = true;
        if (this.lockTimer) {
            // 既存タイマーの解除処理
            clearTimeout(this.lockTimer);
            this.lockTimer = null;
        }
        if (this.scrollLockHandler) {
            // 既存スクロールリスナーの解除処理
            window.removeEventListener('scroll', this.scrollLockHandler);
            this.scrollLockHandler = null;
        }

        // 即時アクティブ化反映
        this.setActive(itemId);

        const debounceWaitMs = C.UIConstants.ScrollSpy.DebounceWaitMs;

        // スクロール停止検知用ハンドラー定義
        this.scrollLockHandler = () => {
            if (this.lockTimer) {
                clearTimeout(this.lockTimer);
            }
            this.lockTimer = setTimeout(() => {
                this.isLocked = false;
                this.lockTimer = null;
                if (this.scrollLockHandler) {
                    window.removeEventListener('scroll', this.scrollLockHandler);
                    this.scrollLockHandler = null;
                }
                // スクロール完了後の現在地判定再実行
                this.updateActive();
            }, debounceWaitMs);
        };

        // スクロール発生時のタイマー延長イベント登録
        window.addEventListener('scroll', this.scrollLockHandler, { passive: true });
        // 初期待機タイマーの設定
        this.scrollLockHandler();
    },

    // 現在のスクロール位置に基づくアクティブカード更新処理
    updateActive() {
        if (this.isLocked || this.cards.length === 0) return;

        const cfg = C.UIConstants.ScrollSpy;
        const scrollBottom = window.innerHeight + window.scrollY;
        const documentHeight = document.documentElement.scrollHeight;

        // ページ最下部到達時の末尾カード選択判定
        if (scrollBottom >= documentHeight - cfg.BottomThresholdPx) {
            const lastCard = this.cards[this.cards.length - 1];
            if (lastCard && lastCard.id) {
                this.setActive(lastCard.id);
                return;
            }
        }

        const referenceLine = cfg.ReferenceOffsetPx;
        let intersectingId = null;
        let closestId = null;
        let minDistance = Infinity;

        // 基準線を跨ぐカードおよび最近傍カードの一括走査処理
        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            const rect = card.getBoundingClientRect();

            if (rect.top <= referenceLine && rect.bottom > referenceLine) {
                intersectingId = card.id;
                break;
            }

            const distance = Math.abs(rect.top - referenceLine);
            if (distance < minDistance) {
                minDistance = distance;
                closestId = card.id;
            }
        }

        const matchedId = intersectingId || closestId;
        if (matchedId) {
            this.setActive(matchedId);
        }
    },

    // スクロール追従監視の初期化処理
    init() {
        this.cards = Array.from(document.querySelectorAll('.card-container')).filter((el) => !!el.id);
        if (this.cards.length === 0) return;

        // 初回表示時のアクティブ項目判定実行
        this.updateActive();

        // スクロールイベントに対する描画最適化リスナー登録
        window.addEventListener(
            'scroll',
            () => {
                if (this.isLocked) return;
                if (this.rafId) {
                    cancelAnimationFrame(this.rafId);
                }
                this.rafId = window.requestAnimationFrame(() => {
                    this.updateActive();
                });
            },
            { passive: true }
        );

        // リサイズイベントに対する再判定リスナー登録
        window.addEventListener(
            'resize',
            () => {
                if (this.isLocked) return;
                this.updateActive();
            },
            { passive: true }
        );
    }
};

// Initialize all modules on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    YdockUI.Clipboard.init();
    YdockUI.DisplayMode.init();
    YdockUI.DeepLink.init();
    YdockUI.Tooltip.init();
    YdockUI.ColumnResizer.init();
    // スクロール追従監視モジュールの初期化
    YdockUI.ScrollSpy.init();
});
