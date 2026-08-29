import { useState, useRef } from 'react';
import { computeSearchMatches, getSearchVisibilityIds } from '../utils/searchGraph';
import { applyVisibilityFilter, ensureNodePositions, getNodeDimensions } from '../utils/dagreLayout';

export function useGraphSearch({
  baseNodes,
  baseEdges,
  nodes,
  setNodes,
  setEdges,
  rfInstance,
  layoutMode,
  focusMode,
  applyDisplayFromBase,
  panToNode,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const searchInputRef = useRef(null);

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      setSearchIndex(0);
      applyDisplayFromBase(layoutMode, focusMode);
      return;
    }

    if (!baseNodes.length) {
      setSearchResults([]);
      return;
    }

    const matches = computeSearchMatches(baseNodes, query);
    setSearchResults(matches);
    setSearchIndex(0);

    if (matches.length === 0) {
      applyDisplayFromBase(layoutMode, focusMode);
      return;
    }

    const visibleIds = getSearchVisibilityIds(matches, baseEdges);
    const { nodes: filteredNodes, edges: filteredEdges } = applyVisibilityFilter(
      baseNodes,
      baseEdges,
      visibleIds
    );
    const displayNodes = ensureNodePositions(filteredNodes);

    setNodes(
      displayNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isSearchMatch: matches.includes(n.id),
          isActiveSearchMatch: n.id === matches[0],
          searchQuery: query,
        },
      }))
    );
    setEdges(filteredEdges);

    if (rfInstance) {
      const targetNode = displayNodes.find((n) => n.id === matches[0]);
      if (targetNode?.position) {
        setTimeout(() => {
          const { width, height } = getNodeDimensions(targetNode);
          rfInstance.setCenter(
            targetNode.position.x + width / 2,
            targetNode.position.y + height / 2,
            { zoom: 1.2, duration: 600 }
          );
        }, 50);
      }
    }
  };

  const panToSearchResult = (index) => {
    if (!rfInstance || !searchResults.length) return;
    panToNode(rfInstance, searchResults[index], nodes);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setSearchQuery('');
      setSearchResults([]);
      setSearchIndex(0);
      applyDisplayFromBase(layoutMode, focusMode);
      searchInputRef.current?.blur();
      return;
    }
    if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault();
      const targetId = searchResults[searchIndex];
      panToSearchResult(searchIndex);
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            isActiveSearchMatch: n.id === targetId,
          },
        }))
      );
      setSearchIndex((searchIndex + 1) % searchResults.length);
    }
  };

  const resetSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchIndex(0);
  };

  return {
    searchQuery,
    searchResults,
    searchIndex,
    searchInputRef,
    handleSearchChange,
    handleSearchKeyDown,
    resetSearch,
  };
}
