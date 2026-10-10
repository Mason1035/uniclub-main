import { createContext, useContext } from 'react';

export const SearchContext = createContext<{ openSearch: () => void } | undefined>(undefined);

export function useGlobalSearch() {
  const context = useContext(SearchContext);
  if (!context) throw new Error('Search controls must be inside the ClassHub Layout');
  return context.openSearch;
}
