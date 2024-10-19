'use client';

// 1. Imports
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { AnimatePresence, motion } from 'framer-motion';
import debounce from 'lodash/debounce';
import Spline from '@splinetool/react-spline';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Local imports
import withAuth from '@/utils/withAuth';
import { findNodeById, getNodeByPath, getNodePath } from '@/utils/tree';
import Counter from './Counter';
import History from './History';
import LoadingPage from './Loading';
import LogoutButton from './LogoutButton';
import { PieGraph } from './PieGraph';
import FullScreenPopup from './FullScreenPopup';

////////////////
// INTERFACES //
///////////////

interface PopupNode {
  probability: number;
  title: string;
  optionNumber: number;
  content: string;
}

interface FlowChartProps {
  initialSituation: string;
  initialAction: string;
  showChart: boolean;
  onChartRendered: () => void;
  updateNumberOfOutcomes: (count: number) => void;
  user: { email: string };
  updateTreeData: (newData: TreeNode) => void;
  selectedFlowchart?: TreeNode | null;
}

interface Outcome {
  title: string;
  description: string;
  probability: number;
}

type NodeType = 'situation' | 'action' | 'outcome';

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

interface FlowchartPageProps {
  user: { email: string };
}

// 3. Constants
const NODE_WIDTH = 200;
const NODE_HEIGHT = 100;
const INITIAL_HORIZONTAL_SPACING = 300;
const HORIZONTAL_SPACING = 550;
const VERTICAL_SPACING = 150;

//////////////////////
// FLOWCHART PAGE ////
//////////////////////

const FlowchartPage: React.FC<FlowchartPageProps> = ({ user }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(['', '']);
  const [showChart, setShowChart] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [outcomesReady, setOutcomesReady] = useState(false);
  const [chartFullyRendered, setChartFullyRendered] = useState(false);
  const [showSpline, setShowSpline] = useState(false);
  const [numberOfOutcomes, setNumberOfOutcomes] = useState(0);
  const isGeneratingRef = useRef(false);
  const abortControllerRef = useRef(new AbortController());
  const [treeData, setTreeData] = useState<TreeNode>(); // Add this line

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id');
      if (id) {
        loadFlowchart(id);
      }
    }
  }, []);

  const [selectedFlowchart, setSelectedFlowchart] = useState<TreeNode | null>(null);

  const supabase = createClientComponentClient();

  const updateTreeData = (newData: TreeNode) => {
    setTreeData(newData);
  };

  const saveFlowchart = async () => {
    const supabase = createClientComponentClient();
    try {
      const { data, error } = await supabase
        .from('flowcharts')
        .insert([
          {
            user_email: user.email,
            tree_data: treeData,
          },
        ])
        .select();

      if (error) {
        console.error('Error saving flowchart:', error);
        alert(`Error saving flowchart: ${error.message}`);
      } else {
        console.log('Flowchart saved successfully:', data);
        alert('Flowchart saved!');
      }
    } catch (err) {
      console.error('Exception when saving flowchart:', err);
      alert(`Exception when saving flowchart: ${err.message}`);
    }
  };

  const loadFlowchart = async (id: string) => {
    try {
      const { data, error } = await supabase.from('flowcharts').select('tree_data').eq('id', id).single();

      if (error) throw error;

      setSelectedFlowchart(data.tree_data);
      setActiveView('outcomes'); // Switch to outcomes view to display the loaded flowchart
    } catch (error) {
      console.error('Error loading flowchart:', error);
    }
  };

  const questions = ['Set the scene', 'Your Move.'];

  const placeholders = [
    'Describe your current situation or environment. This context helps us tailor our assistance.',
    "Given your situation, what's the first step or course of action you plan to take?",
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newAnswers = [...answers];
    newAnswers[step] = e.target.value;
    setAnswers(newAnswers);
  };

  const [isLoading, setIsLoading] = useState(false);

  const handleInputSubmit = async () => {
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else if (!isGeneratingRef.current) {
      setIsLoading(true);
      await debouncedProgressStep();
      setIsLoading(false);
    }
  };

  const progressStep = useCallback(async () => {
    if (isGeneratingRef.current) {
      console.log('Already generating outcomes, skipping...');
      return;
    }

    isGeneratingRef.current = true;
    setIsGenerating(true);
    setShowSpline(true);

    const callId = Date.now();
    console.log(`Starting outcome generation... (Call ID: ${callId})`);

    try {
      abortControllerRef.current.abort(); // Cancel any ongoing requests
      abortControllerRef.current = new AbortController();

      const combinedInput = `${answers[0]}\n${answers[1]}`;

      // EDIT API LINK HERE!
      const response = await fetch('https://willdphan--fastapi-groq-api-generate-outcomes.modal.run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: combinedInput }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`API response received: (Call ID: ${callId})`, data);

      if (Array.isArray(data.outcomes) && data.outcomes.length > 0) {
        console.log(`Updating number of outcomes to ${data.outcomes.length} (Call ID: ${callId})`);
        setNumberOfOutcomes(data.outcomes.length);
      } else {
        console.error(`No outcomes or invalid outcomes array: (Call ID: ${callId})`, data.outcomes);
        setNumberOfOutcomes(0);
      }

      console.log(`Setting outcomesReady to true (Call ID: ${callId})`);
      setOutcomesReady(true);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log(`Request aborted (Call ID: ${callId})`);
        } else {
          console.error(`Error in outcome generation: (Call ID: ${callId})`, error);
        }
      } else {
        console.error(`Unknown error occurred: (Call ID: ${callId})`, error);
      }
    } finally {
      console.log(`Finishing outcome generation... (Call ID: ${callId})`);
      setIsGenerating(false);
      isGeneratingRef.current = false;
    }
  }, [answers]);

  const debouncedProgressStep = useMemo(() => debounce(progressStep, 300), [progressStep]);

  useEffect(() => {
    if (outcomesReady) {
      setShowChart(true);
    }
  }, [outcomesReady]);

  useEffect(() => {
    return () => {
      abortControllerRef.current.abort();
      debouncedProgressStep.cancel();
    };
  }, [debouncedProgressStep]);

  const handleChartRendered = useCallback(() => {
    setChartFullyRendered(true);
    setShowSpline(false);
  }, []);

  const updateNumberOfOutcomes = useCallback((count: number) => {
    setNumberOfOutcomes(count);
  }, []);

  const [activeView, setActiveView] = useState<'profile' | 'outcomes' | 'history'>('outcomes');

  const [skippedQuestions, setSkippedQuestions] = useState(false);

  const handleSkippedQuestions = () => {
    setIsGenerating(true);
    setShowSpline(true);
    setOutcomesReady(true);
    setShowChart(true);
  };

  const scrollToFlowchart = () => {
    window.scrollTo({
      top: window.innerHeight,
      behavior: 'smooth',
    });
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleScrollUp = useCallback(() => {
    console.log('Scroll up button clicked');
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  const handleGoHome = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.location.href = '/';
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    console.log('Zoom state updated:', zoom);
  }, [zoom]);

  const handleZoom = useCallback((direction: 'in' | 'out') => {
    console.log('handleZoom called with direction:', direction);
    setZoom((prevZoom) => {
      let newZoom = direction === 'in' ? prevZoom * 1.2 : prevZoom / 1.2;
      console.log('New zoom calculated:', newZoom);

      // Ensure we don't zoom out beyond fitting the entire graph
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const parentRect = containerRef.current.parentElement?.getBoundingClientRect();

        if (parentRect) {
          const minZoom = Math.min(parentRect.width / containerRect.width, parentRect.height / containerRect.height);
          newZoom = Math.max(newZoom, minZoom);
        }
      }

      console.log('Final zoom value:', newZoom);
      return newZoom;
    });
  }, []);

  return (
    <>
      {isLoading && <LoadingPage />}
      <div
        className={`max-w-screen w-screen overflow-y-auto md:flex md:h-screen md:overflow-hidden ${
          chartFullyRendered ? 'md:flex' : 'block'
        }`}
      >
        <motion.div
          className={`h-screen ${chartFullyRendered ? 'w-full md:w-2/6' : 'w-full'} z-20 flex flex-col ${
            chartFullyRendered ? 'bg-white' : 'bg-[#E8E4DB]'
          } relative`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.a
            href='/'
            className='group absolute left-4 top-4 z-50 border-[1px] border-[#4C4C4C] bg-transparent p-2 transition-colors duration-200 hover:bg-[#4C4C4C]'
            onClick={handleGoHome}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='h-3 w-3 transition-colors duration-200 group-hover:stroke-[#E8E4DB]'
              fill='none'
              viewBox='0 0 24 24'
              stroke='#4C4C4C'
            >
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M10 19l-7-7m0 0l7-7m-7 7h18' />
            </svg>
          </motion.a>

          <div className='relative flex flex-1  flex-col items-center justify-center p-4'>
            <AnimatePresence mode='wait'>
              {!isGenerating && !outcomesReady ? (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className='mt-30 w-[25em] max-w-sm'
                >
                  <motion.h2
                    className='mb-4 text-center font-mono text-lg uppercase'
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                  >
                    {questions[step]}
                  </motion.h2>
                  <form onSubmit={handleInputSubmit}>
                    <motion.textarea
                      value={answers[step]}
                      onChange={handleInputChange}
                      className='placeholder-center mb-4 mb-[-64px] w-full resize-none overflow-auto bg-transparent text-center font-man focus:outline-none focus:ring-0'
                      placeholder={placeholders[step]}
                      autoFocus
                      style={{
                        maxHeight: '200px',
                        minHeight: '200px',
                      }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4, duration: 0.3 }}
                    />
                  </form>
                </motion.div>
              ) : showSpline ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className='flex h-full w-full items-center justify-center bg-[#E8E4DB] text-center text-center '
                >
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                    className='flex items-center justify-center'
                  >
                    <Spline scene='https://prod.spline.design/gbG6-0xtiOTPHBfn/scene.splinecode' />
                  </motion.div>
                </motion.div>
              ) : chartFullyRendered ? (
                <AnimatePresence mode='wait'>
                  {activeView === 'profile' && (
                    <motion.div
                      key='profile'
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className='w-full text-center'
                    >
                      <h2 className='mb-2 font-ibm text-lg uppercase text-[#3C3C3C]'>PROFILE</h2>
                      <h2 className='mb-2 font-man text-lg text-gray-500'>{user.email}</h2>
                      <LogoutButton />
                    </motion.div>
                  )}

                  {activeView === 'outcomes' && (
                    <motion.div
                      key='outcomes'
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className='w-full text-center'
                    >
                      <div className='mb-4'>
                        <span className='font-ibm text-6xl font-bold text-[#3C3C3C]'>
                          <Counter value={numberOfOutcomes} />
                          {`${numberOfOutcomes}`}
                        </span>
                      </div>
                      <h2 className='mb-2 font-ibm text-lg uppercase text-[#3C3C3C]'>Possible outcomes generated</h2>
                      <p className='mb-4 font-man text-gray-500'>Interact with the flowchart.</p>
                      <div className='flex justify-center md:hidden'>
                        <button
                          onClick={scrollToFlowchart}
                          className='flex h-8 w-8 items-center justify-center bg-[#3C3C3C] text-white transition-colors duration-200 hover:bg-[#4C4C4C]'
                          aria-label='Scroll to flowchart'
                        >
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            className='h-4 w-4'
                            fill='none'
                            viewBox='0 0 24 24'
                            stroke='currentColor'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M19 14l-7 7m0 0l-7-7m7 7V3'
                            />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {activeView === 'history' && (
                    <motion.div
                      key='history'
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className='w-full'
                    >
                      <History onLoadFlowchart={loadFlowchart} />
                    </motion.div>
                  )}
                </AnimatePresence>
              ) : null}
            </AnimatePresence>
          </div>

          {/* ONLY SHOW BUTTONS IF CHART IS NOT FULLY RENDERED OR ISNT GENERATING */}
          {!chartFullyRendered && !isGenerating && (
            <motion.div
              className='absolute bottom-5 left-0 right-0 flex justify-center space-x-4'
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.6, duration: 0.3 }}
            >
              <motion.button
                type='button'
                onClick={handleSkippedQuestions}
                className='flex items-center justify-center border border-[1px] border-black bg-[#E8E4DB] px-4 py-2 font-man text-black hover:bg-[#3C3C3C] hover:text-white'
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Skip Questions
              </motion.button>
              <motion.button
                onClick={handleInputSubmit}
                className='flex items-center justify-center border border-[1px] border-black bg-[#3C3C3C] px-4 py-2 font-man text-white hover:bg-[#E8E4DB] hover:text-black'
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Next
              </motion.button>
            </motion.div>
          )}

          {chartFullyRendered && (
            <div className='absolute bottom-4 left-4 flex font-man'>
              <button
                onClick={() => setActiveView('outcomes')}
                className={`mr-2 px-4 py-0 ${
                  activeView === 'outcomes' ? 'bg-[#3C3C3C] text-white' : 'bg-white text-[#3C3C3C]'
                } border border-[#3C3C3C]`}
              >
                Graph
              </button>
              <button
                onClick={() => setActiveView('history')}
                className={`mr-2 px-4 py-0 ${
                  activeView === 'history' ? 'bg-[#3C3C3C] text-white' : 'bg-white text-[#3C3C3C]'
                } border border-[#3C3C3C]`}
              >
                History
              </button>
              <button
                onClick={() => setActiveView('profile')}
                className={`mr-2 px-4 py-1 ${
                  activeView === 'profile' ? 'bg-[#3C3C3C] text-white' : 'bg-white text-[#3C3C3C]'
                } border border-[#3C3C3C]`}
              >
                Profile
              </button>

              <div className='fixed bottom-4 right-4 z-10 flex space-x-2'>
                <button
                  onClick={() => handleZoom('in')}
                  className='border border-[1px] border-black bg-white px-3 py-0 text-black hover:bg-gray-100'
                >
                  +
                </button>
                <button
                  onClick={() => handleZoom('out')}
                  className='border border-[1px] border-black bg-white px-3 py-0 text-black hover:bg-gray-100'
                >
                  -
                </button>
                <button
                  onClick={handleRefresh}
                  className='flex items-center justify-center border border-[1px] border-black bg-white px-2 py-0 text-black hover:bg-gray-100'
                >
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    className='h-4 w-4'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                    />
                  </svg>
                </button>
                <button
                  onClick={handleScrollUp}
                  className='flex items-center justify-center border border-[1px] border-black bg-white px-2 py-0 text-black hover:bg-gray-100 md:hidden'
                >
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    className='h-4 w-4'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 10l7-7m0 0l7 7m-7-7v18' />
                  </svg>
                </button>
              </div>
              <button
                onClick={saveFlowchart}
                className='broder-[1px] rounded-md border border-black bg-[#00B9F9] px-4 py-0 text-black'
              >
                Save
              </button>
            </div>
          )}
        </motion.div>
        {showChart && (
          <div className='relative h-screen w-full transition-all duration-500 md:w-4/6'>
            <FlowChart
              initialSituation={answers[0]}
              initialAction={answers[1]}
              showChart={showChart}
              onChartRendered={handleChartRendered}
              updateNumberOfOutcomes={updateNumberOfOutcomes}
              user={user}
              updateTreeData={updateTreeData}
              selectedFlowchart={selectedFlowchart}
              zoom={zoom}
            />
          </div>
        )}
      </div>
    </>
  );
};

////////////////////////
// FLOWCHART COMPONENT //
////////////////////////

const FlowChart: React.FC<FlowChartProps> = ({
  initialSituation,
  initialAction,
  showChart,
  onChartRendered,
  updateNumberOfOutcomes,
  updateTreeData,
  selectedFlowchart, // Add this prop
  zoom, // Add this prop
}) => {
  useEffect(() => {
    if (selectedFlowchart) {
      setTreeData(selectedFlowchart);
      updateTreeData(selectedFlowchart);
      onChartRendered();
    } else if (showChart) {
      generateInitialFlowchart(initialSituation, initialAction).then(() => {
        onChartRendered();
      });
    }
  }, [showChart, initialSituation, initialAction, onChartRendered, selectedFlowchart]);

  const [treeData, setTreeData] = useState<TreeNode>({
    id: 'start',
    content: '',
    position: { x: 0, y: 0 },
    type: 'action',
    outcomes: [], // This should now be correctly typed
  });

  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [editingNode, setEditingNode] = useState('start');
  const [selectedNodeDetail, setSelectedNodeDetail] = useState(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popupNode, setPopupNode] = useState<PopupNode | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

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
          outcomes: [], // This should now be correctly typed
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

  useEffect(() => {
    if (showChart) {
      generateInitialFlowchart(initialSituation, initialAction).then(() => {
        onChartRendered();
      });
    }
  }, [showChart, initialSituation, initialAction, onChartRendered]);

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

  const handleExpandClick = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      const clickedNode = findNodeById(treeData, nodeId);
      if (clickedNode && clickedNode.type === 'outcome') {
        const popupData: PopupNode = {
          probability: clickedNode.probability ?? 0, // Provide a default value if undefined
          title: clickedNode.title ?? '', // Provide a default value if undefined
          optionNumber: clickedNode.optionNumber ?? 0, // Provide a default value if undefined
          content: clickedNode.content,
        };
        setPopupNode(popupData);
      }
    },
    [treeData]
  );

  const handleNodeDragStart = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      const node = findNodeById(treeData, nodeId);
      if (node) {
        setIsDragging(true);
        setDraggedNode(nodeId);
        setDragOffset({
          x: e.clientX - node.position.x,
          y: e.clientY - node.position.y,
        });
      }
    },
    [treeData]
  );

  const handleNodeDrag = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !draggedNode) return;

      setTreeData((prevTree) => {
        const newTree = JSON.parse(JSON.stringify(prevTree));
        const updateNodePosition = (node: TreeNode): boolean => {
          if (node.id === draggedNode) {
            node.position = {
              x: e.clientX - dragOffset.x,
              y: e.clientY - dragOffset.y,
            };
            return true;
          }
          return node.outcomes.some(updateNodePosition);
        };

        updateNodePosition(newTree);
        updateTreeData(newTree); // Add this line
        return newTree;
      });
    },
    [isDragging, draggedNode, dragOffset, updateTreeData]
  );

  const handleNodeDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedNode(null);
  }, []);

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
            ...solidShadowStyle, // Apply the solid shadow style here
            left: `${node.position.x}px`,
            top: `${node.position.y}px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onClick={(e) => handleNodeClick(node.id, e)}
          onDoubleClick={(e) => handleNodeDoubleClick(node.id, e)}
          onMouseDown={(e) => handleNodeDragStart(e, node.id)}
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
                      probability={node.probability ?? 0} // Use nullish coalescing operator to provide a default value
                      index={path[path.length - 1] ?? 0} // Also provide a default for index
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

  const { minX, minY, maxX, maxY } = getMinMaxCoordinates(treeData);

  const containerWidth = maxX - minX + NODE_WIDTH + HORIZONTAL_SPACING;
  const containerHeight = maxY - minY + NODE_HEIGHT + VERTICAL_SPACING;

  const containerStyle = {
    width: `${containerWidth}px`,
    height: `${containerHeight}px`,
    transform: `scale(${zoom})`,
    transformOrigin: 'top left',
    transition: 'transform 0.3s ease-out',
    padding: '300px', // Increase padding to ensure nodes near the edges are not cut off
    position: 'absolute', // Ensure absolute positioning
    top: `${-minY + 100}px`, // Adjust top based on minimum Y coordinate with extra space
    left: `${-minX + 100}px`, // Adjust left based on minimum X coordinate with extra space
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

export default withAuth(FlowchartPage);
