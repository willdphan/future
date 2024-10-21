/*
COMPONENT THAT RENDERS INTERACTIVE FLOWCHART:

The FlowGraph component is responsible for rendering and managing the actual flowchart visualization.

1. It visualizes a tree-like data structure representing situations, actions, and outcomes.
2. It allows for dynamic generation of outcomes based on user input.
3. It supports user interactions such as clicking, double-clicking, and dragging nodes.
4. It uses SVG to draw connecting lines between nodes.
5. It includes features like node expansion, editing, and selection.
6. It incorporates animations using Framer Motion.
7. It's responsive to zoom levels and manages its own positioning within a container.
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion'; // Add this import

import { findNodeById, getNodeByPath, getNodePath } from '@/utils/tree';

import FullScreenPopup from './FullScreenPopup';
import LoadingPage from './Loading';
import { PieGraph } from './PieGraph'; // Make sure this import path is correct

// CONSTANTS
const NODE_WIDTH = 200;
const NODE_HEIGHT = 100;
const INITIAL_HORIZONTAL_SPACING = 300;
const HORIZONTAL_SPACING = 550;
const VERTICAL_SPACING = 150;

// MIN/MAX COORDS
// Add this function near the top of the component, after the state declarations
const getMinMaxCoordinates = (node: TreeNode) => {
  let minX = node.position.x;
  let minY = node.position.y;
  let maxX = node.position.x;
  let maxY = node.position.y;
  if (node.outcomes) {
    node.outcomes.forEach((outcome: TreeNode) => {
      const { minX: childMinX, minY: childMinY, maxX: childMaxX, maxY: childMaxY } = getMinMaxCoordinates(outcome);
      minX = Math.min(minX, childMinX);
      minY = Math.min(minY, childMinY);
      maxX = Math.max(maxX, childMaxX);
      maxY = Math.max(maxY, childMaxY);
    });
  }
  return { minX, minY, maxX, maxY };
};

const FlowGraph: React.FC<FlowGraphProps> = ({
  initialSituation,
  initialAction,
  showChart,
  onChartRendered,
  updateNumberOfOutcomes,
  updateTreeData,
  selectedFlowchart,
  zoom,
}) => {
  const [treeData, setTreeData] = useState<TreeNode>({
    id: 'start',
    content: '',
    position: { x: 0, y: 0 },
    type: 'action',
    outcomes: [], // This should now be correctly typed
  });
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [editingNode, setEditingNode] = useState('start');
  const containerRef = useRef<HTMLDivElement>(null);
  const [popupNode, setPopupNode] = useState<PopupNode | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

  // RESPONSIBLE FOR INITIALIZING/UPDATING FLOWCHART
  // based on certain conditions
  // If selectedFlowchart exists (i.e., a user has selected a pre-existing flowchart), it updates the local state (setTreeData) and the parent component's state (updateTreeData) with this flowchart.
  // It then calls onChartRendered() to signal that the chart has been rendered.
  useEffect(() => {
    if (selectedFlowchart) {
      setTreeData(selectedFlowchart);
      updateTreeData(selectedFlowchart);
      onChartRendered();
    // when a new chart needs to be generated, calls onChartRendered() to signal completion.
    } else if (showChart) {
      generateInitialFlowchart(initialSituation, initialAction).then(() => {
        onChartRendered();
      });
    }
  }, [showChart, initialSituation, initialAction, onChartRendered, selectedFlowchart, updateTreeData]);

  // used to generate outcomes for the given action
  const generateOutcomes = useCallback(
    async (parentX: number, parentY: number, action: string, isInitial: boolean = false): Promise<TreeNode[]> => {
      console.log('Generating outcomes for action:', action); // Add this line
      if (isInitial) setIsInitialLoading(true);
      try {
        // EDIT API LINK HERE!
        const response = await fetch('https://willdphan--fastapi-groq-api-generate-outcomes.modal.run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: action }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: { outcomes: Outcome[] } = await response.json();
        const totalHeight = (data.outcomes.length - 1) * VERTICAL_SPACING;
        const startY = parentY - totalHeight / 2;

        const newOutcomes: TreeNode[] = data.outcomes.map((outcome: Outcome, i: number) => ({
          id: `outcome-${Date.now()}-${i}`,
          title: outcome.title,
          content: outcome.description,
          probability: outcome.probability,
          optionNumber: i + 1,
          position: {
            x: parentX + HORIZONTAL_SPACING,
            y: startY + i * VERTICAL_SPACING,
          },
          type: 'outcome',
          outcomes: [], 
        }));

        updateNumberOfOutcomes(newOutcomes.length);
        return newOutcomes;
      } catch (error) {
        console.error('Error generating outcomes:', error);
        updateNumberOfOutcomes(0);
        return [];
      } finally {
        if (isInitial) setIsInitialLoading(false);
      }
    },
    [updateNumberOfOutcomes, VERTICAL_SPACING, HORIZONTAL_SPACING]
  );

  // GENERATES INITIAL FLOWCHART
  // first action to call the generateOutcomes function
  // done to start flowchart directly on side of screen
  const generateInitialFlowchart = useCallback(
    async (situation: string, action: string) => {
      const outcomes = await generateOutcomes(0, 0, action, true);
      const totalHeight = (outcomes.length - 1) * VERTICAL_SPACING;

      // Calculate the starting position very close to the left
      const startX = window.innerWidth * 0.1; // 10% from the left edge
      const centerY = window.innerHeight / 2;

      // Position the situation node
      const situationX = startX;
      const situationY = centerY;

      const initialTree: TreeNode = {
        id: 'start',
        content: situation,
        position: { x: situationX, y: situationY },
        type: 'situation',
        outcomes: outcomes.map((outcome, index) => ({
          ...outcome,
          id: `outcome-${Date.now()}-${index}`,
          position: {
            x: situationX + INITIAL_HORIZONTAL_SPACING,
            y: situationY + (index - (outcomes.length - 1) / 2) * VERTICAL_SPACING,
          },
          type: 'outcome',
          outcomes: [],
        })),
      };
      setTreeData(initialTree);
      updateTreeData(initialTree); // Add this line to update the parent component's tree data
    },
    [generateOutcomes, VERTICAL_SPACING, INITIAL_HORIZONTAL_SPACING, updateTreeData]
  ); // Add updateTreeData to dependencies

  // HANDLES NODE SELECTION AND HIGHLIGHTS PATH
  // if path is not null, it sets path as selected path using selectedPath(path)
  const handleNodeClick = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      const clickedNode = findNodeById(treeData, nodeId);
      if (clickedNode) {
        const path = getNodePath(treeData, nodeId);
        if (path !== null) {
          setSelectedPath(path);
          if (clickedNode.type === 'action') {
            setEditingNode(nodeId);
          }
        }
      }
    },
    [treeData]
  );

  // TRIGGERED WHEN USER DOUBLE CLICKS ON NODE, ALLOWS FOR ADDITIONAL ACTION TO TAKE PLACE
  const handleNodeDoubleClick = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      const clickedNode = findNodeById(treeData, nodeId);
      if (clickedNode && clickedNode.type === 'outcome') {
        setTreeData((prevTree) => {
          const newTree = JSON.parse(JSON.stringify(prevTree)) as TreeNode;
          const parentPath = getNodePath(newTree, nodeId);
          if (parentPath === null) return prevTree;

          const parentNodePath = parentPath.slice(0, -1);
          const parentNode = getNodeByPath(newTree, parentNodePath);

          if (!parentNode) return prevTree;

          parentNode.outcomes.forEach((outcome) => {
            outcome.outcomes = [];
          });

          const updateNode = (node: TreeNode): boolean => {
            if (node.id === nodeId) {
              const newAction: TreeNode = {
                id: `action-${Date.now()}`,
                content: '',
                position: {
                  x: node.position.x + HORIZONTAL_SPACING,
                  y: node.position.y,
                },
                type: 'action',
                outcomes: [], // This should now be correctly typed
              };
              node.outcomes = [newAction];
              setEditingNode(newAction.id);
              return true;
            }
            return node.outcomes.some(updateNode);
          };
          updateNode(newTree);
          updateTreeData(newTree); // Add this line

          return newTree;
        });
      }
    },
    [treeData, HORIZONTAL_SPACING]
  );

  // FINDS NODE IN TREE, UPDATE PARENT TREE DATA, UPDATE PARENT COMPONENT DATA, CLEAR STATE
  // called when a user submits content for an action node
  // calls teh generateOutcomes function
  const handleActionSubmit = useCallback(
    async (nodeId: string, content: string) => {
      try {
        const node = findNodeById(treeData, nodeId);
        if (!node) return;

        const outcomes = await generateOutcomes(node.position.x, node.position.y, content);

        setTreeData((prevTree) => {
          const newTree = JSON.parse(JSON.stringify(prevTree)) as TreeNode;
          const updateNode = (node: TreeNode): boolean => {
            if (node.id === nodeId) {
              node.content = content;
              node.outcomes = outcomes;
              return true;
            }
            return node.outcomes.some(updateNode);
          };
          updateNode(newTree);
          updateTreeData(newTree); // Call updateTreeData here
          return newTree;
        });
        setEditingNode('');
      } catch (error) {
        console.error('Error submitting action:', error);
      }
    },
    [treeData, generateOutcomes, updateTreeData]
  );

  // HANDLES EXPAND BUTTON CLICK, AKA WHENEVER USER PRESSES + ON NODE
  const handleExpandClick = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      const clickedNode = findNodeById(treeData, nodeId);
      if (clickedNode && clickedNode.type === 'outcome') {
        const popupData: PopupNode = {
          probability: clickedNode.probability ?? 0,
          title: clickedNode.title ?? '',
          optionNumber: clickedNode.optionNumber ?? 0,
          content: clickedNode.content,
        };
        setPopupNode(popupData);
      }
    },
    [treeData]
  );

  // RENDERS INDIVIDUAL NODES
  const renderNode = (node: TreeNode, depth: number = 0, path: number[] = []): React.ReactNode => {
    if (!node) return null;
    const hasOutcomes = node.outcomes && node.outcomes.length > 0;
    const isSelected = JSON.stringify(path) === JSON.stringify(selectedPath);
    const isOnSelectedPath =
      selectedPath.length >= path.length && JSON.stringify(path) === JSON.stringify(selectedPath.slice(0, path.length));
    const isEditing = editingNode === node.id;

    let nodeBackgroundColor = 'bg-white';
    if (node.type === 'action') {
      nodeBackgroundColor = 'bg-[#3C3C3C]';
    } else if (node.type === 'outcome') {
      nodeBackgroundColor = isOnSelectedPath ? 'bg-[#00B7FC]' : 'bg-[#F2B8EB]';
    }

    const nodeBorderClass = isSelected ? 'border-[2px] border-black' : 'border-[2px] border-black';

    if (depth === 0) {
      return (
        <div key={node.id}>
          {hasOutcomes && (
            <>
            {/* serves as canvas */}
              <svg
                className='absolute'
                style={{
                  left: '0',
                  top: '0',
                  width: '100%',
                  height: '100%',
                  overflow: 'visible',
                  pointerEvents: 'none',
                }}
              >
                {node.outcomes.map((outcome: TreeNode, index: number) => {
                  const isOutcomeSelected = selectedPath.length > path.length && selectedPath[path.length] === index;
                  const startX = 0;
                  const startY = node.position.y + NODE_HEIGHT / 2;
                  const endX = outcome.position.x;
                  const endY = outcome.position.y + NODE_HEIGHT / 2;
                  const midX = (startX + endX) / 2;

                  return (
                    <path
                      key={outcome.id}
                      d={`M ${startX},${startY} C ${midX},${startY} ${midX},${endY} ${endX},${endY}`}
                      fill='none'
                      stroke={isOutcomeSelected ? 'black' : 'gray'}
                      strokeWidth={isOutcomeSelected ? '2' : '1'}
                    />
                  );
                })}
              </svg>
              {node.outcomes.map((outcome: TreeNode, index: number) =>
                renderNode(outcome, depth + 1, [...path, index])
              )}
            </>
          )}
        </div>
      );
    }
    // Add this custom style for the solid shadow
    const solidShadowStyle = {
      boxShadow: '4px 4px 0px 0px rgba(0, 0, 0, 0.75)',
    };

    return (
      <div key={node.id}>
        <div
          className={`text-wrap absolute h-[5em] w-[20em] cursor-pointer p-2 px-4 py-2 text-center font-normal uppercase ${nodeBackgroundColor} ${nodeBorderClass}`}
          style={{
            ...solidShadowStyle,
            left: `${node.position.x}px`,
            top: `${node.position.y}px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onClick={(e) => handleNodeClick(node.id, e)}
          onDoubleClick={(e) => handleNodeDoubleClick(node.id, e)}
        >
          {node.type === 'action' && (isEditing || node.content === '') ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const actionInput = form.elements.namedItem('action') as HTMLInputElement;
                if (actionInput) {
                  handleActionSubmit(node.id, actionInput.value);
                }
              }}
              className='h-full w-full'
            >
              <input
                name='action'
                defaultValue={node.content}
                className={`text-wrap h-full w-full p-2 text-center text-center font-mono text-sm uppercase text-white ${nodeBackgroundColor} outline-none`}
                autoFocus
              />
            </form>
          ) : (
            <>
              <div className='flex w-full flex-grow items-center justify-between '>
                {node.type === 'outcome' && (
                  <div className='h-16 w-16 font-medium'>
                    <PieGraph
                      probability={node.probability ?? 0}
                      index={path[path.length - 1] ?? 0}
                      isSelected={isSelected || isOnSelectedPath}
                    />
                  </div>
                )}
                <div className='flex-grow overflow-hidden text-sm text-black'>
                  <div className='overflow-hidden text-ellipsis font-ibm'>
                    {node.type === 'action' ? node.content : node.title}
                  </div>
                </div>
                {node.type === 'outcome' && (
                  <button
                    className={`flex-shrink-0 text-xl ${
                      isSelected ? 'bg-[#00B7FC] hover:bg-[#00A6E5]' : 'hover:bg-[#DCA7D6]'
                    } pl-2 pr-2 text-black transition-colors duration-200`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExpandClick(node.id, e);
                    }}
                  >
                    +
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {hasOutcomes && (
          <>
            <svg
              className='absolute'
              style={{ left: '0', top: '0', width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
            >
              {node.outcomes.map((outcome, index) => {
                const isOutcomeSelected = selectedPath.length > path.length && selectedPath[path.length] === index;
                const startX = node.position.x + 320;
                const startY = node.position.y + NODE_HEIGHT / 2;
                const endX = outcome.position.x;
                const endY = outcome.position.y + NODE_HEIGHT / 2;
                const midX = (startX + endX) / 2;

                return (
                  <motion.path
                    key={outcome.id}
                    d={`M ${startX},${startY} C ${midX},${startY} ${midX},${endY} ${endX},${endY}`}
                    fill='none'
                    stroke={isOutcomeSelected ? 'black' : '#C2BEB5'}
                    strokeWidth={isOutcomeSelected ? '3' : '2'}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: (depth + 1) * 0.1 }}
                  />
                );
              })}
            </svg>
            {hasOutcomes && node.outcomes.map((outcome, index) => renderNode(outcome, depth + 1, [...path, index]))}
          </>
        )}
      </div>
    );
  };

  const { minX, minY, maxX, maxY } = getMinMaxCoordinates(treeData);
  const containerWidth = maxX - minX + NODE_WIDTH + HORIZONTAL_SPACING;
  const containerHeight = maxY - minY + NODE_HEIGHT + VERTICAL_SPACING;

  // css styling
  const containerStyle: React.CSSProperties = {
    width: `${containerWidth}px`,
    height: `${containerHeight}px`,
    transform: `scale(${zoom})`,
    transformOrigin: 'top left',
    transition: 'transform 0.3s ease-out',
    padding: '300px',
    position: 'absolute',
    top: `${-minY + 100}px`,
    left: `${-minX + 100}px`,
  };

  return (
    <>
      {isInitialLoading && <LoadingPage />}
      <div className='relative h-full w-full overflow-auto bg-[#E8E4DB]'>
        <div ref={containerRef} style={containerStyle} className='relative min-h-full' key={JSON.stringify(treeData)}>
          {renderNode(treeData)}
        </div>
        {popupNode && <FullScreenPopup node={popupNode} onClose={() => setPopupNode(null)} />}
      </div>
    </>
  );
};

export default FlowGraph; 
