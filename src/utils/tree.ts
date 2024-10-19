
interface TreeNode {
    id: string;
    content: string;
    position: { x: number; y: number };
    type: NodeType;
    outcomes: TreeNode[];
    probability?: number;
    title?: string;
    optionNumber?: number;
  }

type NodeType = 'situation' | 'action' | 'outcome';

export const findNodeById = (tree: TreeNode, id: string): TreeNode | null => {
    if (tree.id === id) {
      return tree;
    }
    for (const outcome of tree.outcomes) {
      const found = findNodeById(outcome, id);
      if (found) {
        return found;
      }
    }
    return null;
  };
  
 export const getNodePath = (tree: TreeNode, id: string): number[] | null => {
    if (tree.id === id) {
      return [];
    }
    for (let i = 0; i < tree.outcomes.length; i++) {
      const path = getNodePath(tree.outcomes[i], id);
      if (path !== null) {
        return [i, ...path];
      }
    }
    return null;
  };
  
export const getNodeByPath = (tree: TreeNode, path: number[]): TreeNode | null => {
    let currentNode = tree;
    for (const index of path) {
      if (currentNode.outcomes[index]) {
        currentNode = currentNode.outcomes[index];
      } else {
        return null;
      }
    }
    return currentNode;
  };