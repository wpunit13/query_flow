import TableNode from './TableNode';
import JoinNode from './JoinNode';
import UnionNode from './UnionNode';

/** Stable node type map — must live outside components (React Flow + HMR). */
export const flowNodeTypes = {
  tableNode: TableNode,
  joinNode: JoinNode,
  unionNode: UnionNode,
};
