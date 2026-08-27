import { createContext, useContext } from 'react';

export const GraphActionsContext = createContext(null);

export function useGraphActions() {
  return useContext(GraphActionsContext);
}
