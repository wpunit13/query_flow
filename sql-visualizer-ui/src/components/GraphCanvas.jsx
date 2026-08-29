import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useState } from 'react';
import { minimapNodeColor, minimapNodeStrokeColor } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { flowNodeTypes } from './nodes/flowNodeTypes';

export default function GraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onInit,
  onNodeClick,
  onPaneClick,
  showMinimap = true,
}) {
  const { theme } = useTheme();
  const [nodesDraggable, setNodesDraggable] = useState(true);

  const handleNodesChange = useCallback(
    (changes) => {
      if (!nodesDraggable) {
        const filtered = changes.filter((change) => change.type !== 'position');
        if (filtered.length > 0) {
          onNodesChange(filtered);
        }
        return;
      }
      onNodesChange(changes);
    },
    [onNodesChange, nodesDraggable]
  );

  const handleInteractiveChange = useCallback((interactive) => {
    setNodesDraggable(interactive);
  }, []);

  return (
    <div
      style={{
        flexGrow: 1,
        overflow: 'hidden',
        background: theme.bg,
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={flowNodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodesDraggable={nodesDraggable}
        nodesConnectable={false}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnScroll={false}
        defaultEdgeOptions={{
          style: { stroke: theme.edgeStroke, strokeWidth: 2.75 },
        }}
        minZoom={0.02}
        maxZoom={2}
        fitViewOptions={{ padding: 0.08, minZoom: 0.02, maxZoom: 1 }}
        style={{ background: theme.bg }}
      >
        <Background color={theme.backgroundGrid} gap={20} size={1} />
        <Controls
          style={{ boxShadow: theme.shadowCard }}
          onInteractiveChange={handleInteractiveChange}
        />
        {showMinimap && (
          <MiniMap
            nodeColor={minimapNodeColor}
            nodeStrokeColor={minimapNodeStrokeColor}
            nodeStrokeWidth={3}
            nodeBorderRadius={4}
            maskColor={theme.minimapMask}
            pannable={true}
            zoomable={true}
            style={{
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: theme.cardBg,
              width: 240,
              height: 180,
            }}
          />
        )}
      </ReactFlow>
    </div>
  );
}
