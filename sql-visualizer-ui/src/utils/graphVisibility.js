/**
 * Toggle upstream dependency visibility without re-layout (preserves node positions).
 */
export const toggleNodeCollapse = (toggledNodeId, allNodes, allEdges, setNodes, setEdges) => {
  const toggledNodes = allNodes.map((n) =>
    n.id === toggledNodeId ? { ...n, data: { ...n.data, collapsed: !n.data.collapsed } } : n
  );

  const visibleNodeIds = new Set();
  const leafNodes = toggledNodes.filter((n) => !allEdges.some((e) => e.source === n.id)).map((n) => n.id);
  let queue = [...leafNodes];

  while (queue.length > 0) {
    const currId = queue.shift();
    visibleNodeIds.add(currId);
    const currNode = toggledNodes.find((n) => n.id === currId);

    if (!currNode?.data?.collapsed) {
      const incomingEdges = allEdges.filter((e) => e.target === currId);
      incomingEdges.forEach((e) => {
        if (!visibleNodeIds.has(e.source) && !queue.includes(e.source)) queue.push(e.source);
      });
    }
  }

  setNodes(toggledNodes.map((n) => ({ ...n, hidden: !visibleNodeIds.has(n.id) })));
  setEdges(
    allEdges.map((e) => ({
      ...e,
      hidden: !visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target),
    }))
  );
};

export const getConnectedElements = (nodeId, allEdges) => {
  const connectedNodes = new Set([nodeId]);
  const connectedEdges = new Set();

  let queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    allEdges.forEach((e) => {
      if (e.target === current && !connectedEdges.has(e.id)) {
        connectedEdges.add(e.id);
        connectedNodes.add(e.source);
        queue.push(e.source);
      }
    });
  }

  queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    allEdges.forEach((e) => {
      if (e.source === current && !connectedEdges.has(e.id)) {
        connectedEdges.add(e.id);
        connectedNodes.add(e.target);
        queue.push(e.target);
      }
    });
  }

  return { connectedNodes, connectedEdges };
};
