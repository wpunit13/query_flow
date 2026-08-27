import { useCallback } from 'react';

export function useGraphLayout(rfInstance) {
  const fitGraphToView = useCallback(
    (instance = rfInstance) => {
      if (!instance) return;
      setTimeout(() => {
        instance.fitView({ padding: 0.08, minZoom: 0.02, maxZoom: 1, duration: 600 });
      }, 80);
    },
    [rfInstance]
  );

  return { fitGraphToView };
}
