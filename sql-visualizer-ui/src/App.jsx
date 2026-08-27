import React, { useState, useMemo, useCallback } from 'react';
import { ReactFlow, useNodesState, useEdgesState, Background, Controls, MiniMap, Handle, Position, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

// --- THEME & DESIGN TOKENS ---
const theme = {
  bg: '#f8fafc',
  cardBg: '#ffffff',
  border: '#e2e8f0',
  headerBg: '#f1f5f9',
  textMain: '#0f172a',
  textMuted: '#64748b',
  primary: '#3b82f6',
  joinBg: '#f59e0b',
  highlight: '#fbbf24',
};

// --- ICONS ---
const TableIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', color: theme.primary }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
);
const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);
const EyeOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
);
const ResetIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
);

// --- DYNAMIC DAGRE LAYOUT ---
const getLayoutedElements = (nodes, edges) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 120 });

  nodes.forEach((node) => {
    if (!node.hidden) dagreGraph.setNode(node.id, { width: 220, height: 150 });
  });

  edges.forEach((edge) => {
    if (!edge.hidden) dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    if (node.hidden) return node;
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: { x: nodeWithPosition.x - 110, y: nodeWithPosition.y - 75 },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// --- ALGORITHM: COLLAPSE UPSTREAM DEPENDENCIES ---
const toggleNodeCollapse = (toggledNodeId, allNodes, allEdges, setNodes, setEdges) => {
  const toggledNodes = allNodes.map(n => n.id === toggledNodeId ? { ...n, data: { ...n.data, collapsed: !n.data.collapsed } } : n);

  const visibleNodeIds = new Set();
  const leafNodes = toggledNodes.filter(n => !allEdges.some(e => e.source === n.id)).map(n => n.id);
  let queue = [...leafNodes];

  while(queue.length > 0) {
    const currId = queue.shift();
    visibleNodeIds.add(currId);
    const currNode = toggledNodes.find(n => n.id === currId);

    if (!currNode?.data?.collapsed) {
      const incomingEdges = allEdges.filter(e => e.target === currId);
      incomingEdges.forEach(e => {
        if (!visibleNodeIds.has(e.source) && !queue.includes(e.source)) queue.push(e.source);
      });
    }
  }

  const visibilityNodes = toggledNodes.map(n => ({ ...n, hidden: !visibleNodeIds.has(n.id) }));
  const visibilityEdges = allEdges.map(e => ({ ...e, hidden: !visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target) }));

  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(visibilityNodes, visibilityEdges);
  setNodes(layoutedNodes);
  setEdges(layoutedEdges);
};

// --- CUSTOM NODE: Expandable Table Card ---
const ExpandableTableNode = ({ id, data }) => {
  const [expanded, setExpanded] = useState(true);
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();

  const hasColumns = data.columns && data.columns.length > 0;
  const isHighlighted = data.isSearchMatch;
  const hasIncoming = getEdges().some(e => e.target === id);

  return (
    <div style={{
      background: theme.cardBg,
      border: `2px solid ${isHighlighted ? theme.highlight : theme.border}`,
      borderRadius: '8px',
      minWidth: '240px',
      boxShadow: isHighlighted ? `0 0 15px ${theme.highlight}80` : '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      fontFamily: '"Inter", sans-serif',
      transition: 'all 0.3s ease'
    }}>
      <Handle type="target" position={Position.Top} style={{ background: theme.border, width: '8px', height: '8px' }} />

      <div style={{ padding: '12px', background: isHighlighted ? '#fef3c7' : theme.headerBg, borderBottom: expanded && hasColumns ? `1px solid ${theme.border}` : 'none', borderTopLeftRadius: '6px', borderTopRightRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        <div style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: '600', color: theme.textMain }}>
          <TableIcon />
          {data.label}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {hasIncoming && (
            <button
              title={data.collapsed ? "Show Upstream Dependencies" : "Hide Upstream Dependencies"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleNodeCollapse(id, getNodes(), getEdges(), setNodes, setEdges);
              }}
              style={{
                cursor: 'pointer',
                backgroundColor: data.collapsed ? theme.primary : '#e2e8f0',
                color: data.collapsed ? 'white' : theme.textMuted,
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                fontWeight: 'bold',
                transition: 'background-color 0.2s'
              }}
            >
              {data.collapsed ? <EyeOffIcon /> : <EyeIcon />}
              {data.collapsed ? 'HIDDEN' : 'HIDE'}
            </button>
          )}
          {hasColumns && (
            <div onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} style={{ cursor: 'pointer', color: theme.textMuted, fontSize: '10px', padding: '4px' }}>
              {expanded ? '▲' : '▼'}
            </div>
          )}
        </div>
      </div>

      {expanded && hasColumns && (
        <div style={{ padding: '8px 0', fontSize: '12px' }}>
          {data.columns.map((col, idx) => (
            <div key={idx} style={{ padding: '6px 12px', color: theme.textMuted, borderBottom: idx === data.columns.length - 1 ? 'none' : `1px solid ${theme.bg}` }}>
              <span>{col}</span>
            </div>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: theme.border, width: '8px', height: '8px' }} />
    </div>
  );
};

// --- CUSTOM NODE: Expandable Join Badge ---
const JoinNode = ({ id, data }) => {
  const [expanded, setExpanded] = useState(false);
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();

  const hasConditions = data.conditions && data.conditions.length > 0;
  const isHighlighted = data.isSearchMatch;
  const hasIncoming = getEdges().some(e => e.target === id);

  return (
    <div style={{
      background: theme.cardBg,
      border: `2px solid ${isHighlighted ? theme.highlight : theme.joinBg}`,
      borderRadius: expanded ? '8px' : '20px',
      minWidth: expanded ? '200px' : 'auto',
      boxShadow: isHighlighted ? `0 0 15px ${theme.highlight}` : '0 2px 4px rgb(0 0 0 / 0.05)',
      fontFamily: '"Inter", sans-serif',
      transition: 'all 0.2s ease',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: expanded ? 10 : 1
    }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      <div style={{ padding: '6px 12px', background: theme.cardBg, color: theme.joinBg, fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: hasConditions ? 'pointer' : 'default' }} onClick={(e) => { e.stopPropagation(); if (hasConditions) setExpanded(!expanded); }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="16" cy="16" r="6"></circle><circle cx="8" cy="8" r="6"></circle></svg>
          {data.label}
          {hasConditions && <span style={{ fontSize: '9px', opacity: 0.7 }}>{expanded ? '▲' : '▼'}</span>}
        </div>

        {hasIncoming && (
            <button
              title={data.collapsed ? "Show Upstream" : "Hide Upstream"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleNodeCollapse(id, getNodes(), getEdges(), setNodes, setEdges);
              }}
              style={{
                cursor: 'pointer',
                backgroundColor: data.collapsed ? theme.joinBg : 'rgba(245, 158, 11, 0.15)',
                color: data.collapsed ? 'white' : theme.joinBg,
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '4px'
              }}
            >
              {data.collapsed ? <EyeOffIcon /> : <EyeIcon />}
            </button>
        )}
      </div>

      {expanded && hasConditions && (
        <div style={{ padding: '8px 12px', background: '#fef3c7', color: '#92400e', fontSize: '11px', fontFamily: '"JetBrains Mono", monospace', borderTop: `1px solid ${theme.joinBg}40`, wordBreak: 'break-word', textAlign: 'center' }}>
          {data.conditions.map((cond, idx) => (
            <div key={idx} style={{ padding: '2px 0' }}><strong style={{ opacity: 0.7 }}>ON</strong><br/>{cond}</div>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [sql, setSql] = useState('WITH cte1 AS (SELECT id, name FROM users JOIN orders ON users.id = orders.user_id) SELECT id FROM cte1');
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [rfInstance, setRfInstance] = useState(null);

  const nodeTypes = useMemo(() => ({ tableNode: ExpandableTableNode, joinNode: JoinNode }), []);

  const handleParseSql = async () => {
    setLoading(true);
    setSearchQuery('');
    setSearchResults([]);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/parse-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sql, dialect: 'bigquery' })
      });

      const data = await response.json();

      const professionalEdges = data.edges.map(edge => ({
        ...edge,
        type: 'default',
        animated: false,
        style: { stroke: '#94a3b8', strokeWidth: 2, transition: 'all 0.3s ease' }
      }));

      const initializedNodes = data.nodes.map(n => ({ ...n, hidden: false, data: { ...n.data, collapsed: false }}));

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initializedNodes, professionalEdges);

      setNodes(layoutedNodes.map(n => ({ ...n, style: { opacity: 1, transition: 'opacity 0.3s ease' } })));
      setEdges(layoutedEdges);
    } catch (error) {
      alert("Error parsing SQL. Is your FastAPI server running?");
    }
    setLoading(false);
  };

  // --- NEW: RESET / EXPAND ALL LOGIC ---
  const handleResetCanvas = () => {
    const resetNodes = nodes.map(n => ({
      ...n,
      hidden: false,
      style: { ...n.style, opacity: 1 },
      data: { ...n.data, collapsed: false }
    }));

    const resetEdges = edges.map(e => ({
      ...e,
      hidden: false,
      animated: false,
      style: { ...e.style, stroke: '#94a3b8', strokeWidth: 2, opacity: 1 }
    }));

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(resetNodes, resetEdges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    if (rfInstance) {
      setTimeout(() => rfInstance.fitView({ duration: 800, padding: 0.2 }), 50);
    }
  };

  // --- SEARCH LOGIC ---
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isSearchMatch: false } })));
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matches = [];

    setNodes(nds => nds.map(n => {
      const isMatch = (n.data.label && n.data.label.toLowerCase().includes(lowerQuery)) ||
                      (n.data.columns && n.data.columns.some(col => col.toLowerCase().includes(lowerQuery)));
      if (isMatch) matches.push(n.id);
      return { ...n, data: { ...n.data, isSearchMatch: isMatch } };
    }));

    setSearchResults(matches);
    setSearchIndex(0);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchResults.length > 0 && rfInstance) {
      const nextIndex = (searchIndex + 1) % searchResults.length;
      setSearchIndex(nextIndex);
      const targetNode = rfInstance.getNode(searchResults[searchIndex]);
      if (targetNode) {
        rfInstance.setCenter(targetNode.position.x + 110, targetNode.position.y + 75, { zoom: 1.2, duration: 800 });
      }
    }
  };

  // --- CLICK LINEAGE HIGHLIGHTING ---
  const getConnectedElements = (nodeId, allEdges) => {
    const connectedNodes = new Set([nodeId]);
    const connectedEdges = new Set();

    let queue = [nodeId];
    while(queue.length > 0) {
      const current = queue.shift();
      allEdges.forEach(e => {
        if (e.target === current && !connectedEdges.has(e.id)) {
          connectedEdges.add(e.id);
          connectedNodes.add(e.source);
          queue.push(e.source);
        }
      });
    }

    queue = [nodeId];
    while(queue.length > 0) {
      const current = queue.shift();
      allEdges.forEach(e => {
        if (e.source === current && !connectedEdges.has(e.id)) {
          connectedEdges.add(e.id);
          connectedNodes.add(e.target);
          queue.push(e.target);
        }
      });
    }
    return { connectedNodes, connectedEdges };
  };

  const onNodeClick = useCallback((event, node) => {
    if (node.hidden) return;

    const { connectedNodes, connectedEdges } = getConnectedElements(node.id, edges);

    setNodes(nds => nds.map(n => ({
      ...n,
      style: { ...n.style, opacity: connectedNodes.has(n.id) ? 1 : 0.2 }
    })));

    setEdges(eds => eds.map(e => ({
      ...e,
      animated: connectedEdges.has(e.id),
      style: {
        ...e.style,
        stroke: connectedEdges.has(e.id) ? theme.primary : '#e2e8f0',
        strokeWidth: connectedEdges.has(e.id) ? 3 : 1,
        opacity: connectedEdges.has(e.id) ? 1 : 0.2
      }
    })));
  }, [edges, setNodes, setEdges]);

  const onPaneClick = useCallback(() => {
    setNodes(nds => nds.map(n => ({ ...n, style: { ...n.style, opacity: 1 } })));
    setEdges(eds => eds.map(e => ({ ...e, animated: false, style: { ...e.style, stroke: '#94a3b8', strokeWidth: 2, opacity: 1 } })));
  }, [setNodes, setEdges]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', padding: '20px', fontFamily: '"Inter", sans-serif', background: '#f1f5f9' }}>

      {/* THE UPDATED HEADER CONTAINER */}
      <div style={{ marginBottom: '20px', background: 'white', padding: '16px 20px', borderRadius: '8px', boxShadow: '0 1px 2px rgb(0 0 0 / 0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Top Row: Title and Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: theme.textMain }}>SQL Lineage Studio</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Search Bar */}
            <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${theme.border}`, borderRadius: '6px', padding: '8px 12px', background: theme.bg, minWidth: '240px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.textMuted} strokeWidth="2" style={{ marginRight: '8px' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" placeholder="Search table or column..." value={searchQuery} onChange={handleSearchChange} onKeyDown={handleSearchKeyDown} style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '13px', color: theme.textMain }} />
              {searchResults.length > 0 && <span style={{ fontSize: '11px', color: theme.textMuted, whiteSpace: 'nowrap', marginLeft: '8px' }}>{searchIndex === 0 && searchResults.length > 0 ? searchResults.length : searchIndex} / {searchResults.length} (Enter ↵)</span>}
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleResetCanvas}
              style={{ padding: '8px 16px', backgroundColor: 'white', color: theme.textMain, border: `1px solid ${theme.border}`, borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s', whiteSpace: 'nowrap', height: '36px' }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = theme.headerBg}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
            >
              <ResetIcon />
              Reset
            </button>
            <button
              onClick={handleParseSql} disabled={loading}
              style={{ padding: '8px 24px', backgroundColor: theme.primary, color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', height: '36px' }}
            >
              {loading ? 'Analyzing...' : 'Render DAG'}
            </button>
          </div>
        </div>

        {/* Bottom Row: Full Width SQL Input */}
        <textarea
          value={sql} onChange={(e) => setSql(e.target.value)} rows={4}
          style={{ width: '100%', padding: '12px', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', border: `1px solid ${theme.border}`, borderRadius: '6px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>

      {/* Canvas Area */}
      <div style={{ flexGrow: 1, border: `1px solid ${theme.border}`, borderRadius: '8px', background: theme.bg, overflow: 'hidden' }}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onInit={setRfInstance} onNodeClick={onNodeClick} onPaneClick={onPaneClick} fitView>
          <Background color="#e2e8f0" gap={20} size={1} />
          <Controls style={{ boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
          <MiniMap nodeStrokeColor="#cbd5e1" nodeColor="#f8fafc" maskColor="rgba(241, 245, 249, 0.7)" pannable={true} zoomable={true} style={{ border: `1px solid ${theme.border}`, borderRadius: '8px', overflow: 'hidden', backgroundColor: 'white', width: 240, height: 180 }} />
        </ReactFlow>
      </div>
    </div>
  );
}