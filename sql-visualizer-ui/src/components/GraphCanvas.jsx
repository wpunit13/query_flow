import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { theme, minimapNodeColor, minimapNodeStrokeColor } from '../theme';
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
  return (
    <div style={{ flexGrow: 1, overflow: 'hidden' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={flowNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        minZoom={0.02}
        maxZoom={2}
        fitViewOptions={{ padding: 0.08, minZoom: 0.02, maxZoom: 1 }}
      >
        <Background color="#e2e8f0" gap={20} size={1} />
        <Controls style={{ boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
        {showMinimap && (
          <MiniMap
            nodeColor={minimapNodeColor}
            nodeStrokeColor={minimapNodeStrokeColor}
            nodeStrokeWidth={3}
            nodeBorderRadius={4}
            maskColor="rgba(241, 245, 249, 0.6)"
            pannable={true}
            zoomable={true}
            style={{
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: 'white',
              width: 240,
              height: 180,
            }}
          />
        )}
      </ReactFlow>
    </div>
  );
}
