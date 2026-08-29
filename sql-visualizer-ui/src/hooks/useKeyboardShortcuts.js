import { useEffect } from 'react';

export function useKeyboardShortcuts({
  onFocusSearch,
  onFitView,
  onReset,
  onClearSelection,
  onFocusUpstream,
  onFocusDownstream,
  onLayoutTB,
  onLayoutLR,
  onToggleDiff,
  onToggleStudioMode,
  onToggleZen,
  onViewGraph,
  onViewTable,
  onViewSource,
  onViewPipelineTab,
  onViewOperations,
  onViewTarget,
  onSetPipelineGraph,
  onSetWholeGraph,
  isTableView,
  enabled = true,
  zenMode = false,
  studioMode = 'author',
  canSwitchView = false,
  canFocusSearch = false,
}) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e) => {
      const target = e.target;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (e.key === '/' && !isInput && canFocusSearch) {
        e.preventDefault();
        onFocusSearch?.();
        return;
      }

      if (e.key === 'Escape' && isInput) {
        e.preventDefault();
        target.blur();
        return;
      }

      if (isInput) return;

      // Let the browser keep Cmd/Ctrl shortcuts (Cmd+R refresh, Cmd+F find, etc.).
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      switch (key) {
        case 'f':
          if (!isInput) {
            e.preventDefault();
            onFitView?.();
          }
          break;
        case 'r':
          if (!isInput) {
            e.preventDefault();
            onReset?.();
          }
          break;
        case 'Escape':
          onClearSelection?.();
          break;
        case 'u':
          if (!isInput && !isTableView) {
            e.preventDefault();
            onFocusUpstream?.();
          }
          break;
        case 'd':
          if (!isInput && !isTableView) {
            e.preventDefault();
            onFocusDownstream?.();
          }
          break;
        case 'e':
          if (!isInput) {
            e.preventDefault();
            onToggleStudioMode?.();
          }
          break;
        case 'g':
          if (!isInput && canSwitchView) {
            e.preventDefault();
            onViewGraph?.();
          }
          break;
        case 't':
          if (!isInput) {
            e.preventDefault();
            if (isTableView) onViewTarget?.();
            else if (canSwitchView) onViewTable?.();
          }
          break;
        case 'z':
          if (!isInput && studioMode === 'explore') {
            e.preventDefault();
            onToggleZen?.();
          }
          break;
        case 's':
          if (!isInput && isTableView) {
            e.preventDefault();
            onViewSource?.();
          }
          break;
        case 'p':
          if (!isInput) {
            e.preventDefault();
            if (isTableView) onViewPipelineTab?.();
            else onSetPipelineGraph?.();
          }
          break;
        case 'o':
          if (!isInput && isTableView) {
            e.preventDefault();
            onViewOperations?.();
          }
          break;
        case 'w':
          if (!isInput && !isTableView) {
            e.preventDefault();
            onSetWholeGraph?.();
          }
          break;
        case '1':
          if (!isInput && !isTableView) onLayoutTB?.();
          break;
        case '2':
          if (!isInput && !isTableView) onLayoutLR?.();
          break;
        case '?':
          if (!isInput) onToggleDiff?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    enabled,
    zenMode,
    studioMode,
    onFocusSearch,
    onFitView,
    onReset,
    onClearSelection,
    onFocusUpstream,
    onFocusDownstream,
    onLayoutTB,
    onLayoutLR,
    onToggleDiff,
    onToggleStudioMode,
    onToggleZen,
    onViewGraph,
    onViewTable,
    onViewSource,
    onViewPipelineTab,
    onViewOperations,
    onViewTarget,
    onSetPipelineGraph,
    onSetWholeGraph,
    isTableView,
    canSwitchView,
    canFocusSearch,
  ]);
}
