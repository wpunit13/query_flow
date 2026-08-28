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
  onLayoutRadial,
  onToggleDiff,
  onToggleStudioMode,
  onToggleZen,
  onViewGraph,
  onViewTable,
  enabled = true,
  zenMode = false,
  studioMode = 'author',
  canSwitchView = false,
}) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e) => {
      const target = e.target;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        onFocusSearch?.();
        return;
      }

      if (isInput && e.key !== 'Escape') return;

      switch (e.key) {
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
          if (!isInput) {
            e.preventDefault();
            onFocusUpstream?.();
          }
          break;
        case 'd':
          if (!isInput) {
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
          if (!isInput && canSwitchView) {
            e.preventDefault();
            onViewTable?.();
          }
          break;
        case 'z':
          if (!isInput && studioMode === 'explore') {
            e.preventDefault();
            onToggleZen?.();
          }
          break;
        case '1':
          if (!isInput) onLayoutTB?.();
          break;
        case '2':
          if (!isInput) onLayoutLR?.();
          break;
        case '3':
          if (!isInput) onLayoutRadial?.();
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
    onLayoutRadial,
    onToggleDiff,
    onToggleStudioMode,
    onToggleZen,
    onViewGraph,
    onViewTable,
    canSwitchView,
  ]);
}
