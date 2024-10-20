type NodeType = 'situation' | 'action' | 'outcome';

interface Flowchart {
    id: string;
    user_email: string;
    tree_data: any;
    created_at: string;
  }
  
interface HistoryProps {
    onLoadFlowchart: (id: string) => Promise<void>;
}

interface PopupNode {
    probability: number;
    title: string;
    optionNumber: number;
    content: string;
  }
  
  interface FullScreenPopupProps {
    node: PopupNode;
    onClose: () => void;
  }

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

interface FlowChartPageProps {
  user: { email: string };
}

interface FlowGraphProps {
    initialSituation: string;
    initialAction: string;
    showChart: boolean;
    onChartRendered: () => void;
    updateNumberOfOutcomes: (count: number) => void;
    user: { email: string };
    updateTreeData: (newData: TreeNode) => void;
    selectedFlowchart?: TreeNode | null;
    zoom: Number;
  }

  
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
  
  interface PopupNode {
    probability: number;
    title: string;
    optionNumber: number;
    content: string;
  }
  
  interface PieGraphProps {
    probability: number;
    index: number;
    isSelected: boolean;
  }


interface ComponentProps {
    probability: number;
    index: number;
    isSelected: boolean;
  }
  
  interface CounterProps {
    value: number;
  }
  