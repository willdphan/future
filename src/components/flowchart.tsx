'use client';
import React, { useCallback, useEffect, useMemo,useRef, useState } from 'react';
import { Router, useRouter } from 'next/router';
import DOMPurify from 'dompurify';
import { AnimatePresence,motion } from 'framer-motion';
import debounce from 'lodash/debounce';
import { Cell, Pie, PieChart, ResponsiveContainer,Tooltip } from 'recharts';

import { signOut as authSignOut } from '@/app/(auth)/auth-actions';
import { supabaseMiddlewareClient } from '@/libs/supabase/supabase-middleware-client';
import withAuth from '@/utils/withAuth';
import Spline from '@splinetool/react-spline';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

import Counter from './Counter';
import History from './history';
import LoadingPage from './loading';


////////////////
// INTERFACES //
///////////////

interface ComponentProps {
  probability: number;
  index: number;
  isSelected: boolean;
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


//////////////////////
// HELPER FUNCTIONS //
//////////////////////

import { redirect } from 'next/navigation';

import { signOut } from '@/app/(auth)/auth-actions';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';



function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await signOut();
      // redirect('/signup')
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <button className='bg-[#3C3C3C] text-white font-man py-1 px-3 mt-2 border-none' onClick={handleLogout} disabled={isLoading}>
      {isLoading ? 'Logging Out...' : 'Log Out'}
    </button>
  );
}


const findNodeById = (tree: TreeNode, id: string): TreeNode | null => {
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

const getNodePath = (tree: TreeNode, id: string): number[] | null => {
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

const getNodeByPath = (tree: TreeNode, path: number[]): TreeNode | null => {
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

const Component: React.FC<ComponentProps> = ({ probability, index, isSelected }) => {
  const data = [
    { name: "Probability", value: probability },
    { name: "Remaining", value: 100 - probability }
  ];

  const nodeWidth = Math.max(20, probability.toFixed(0).length * 10);

  return (
    <div className={`relative w-${nodeWidth} h-16`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius="100%"
            innerRadius="0%"
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            <Cell fill={isSelected ? "#009BD6" : "#DCA7D6"} />
            <Cell fill="transparent" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg text-[#3C3C3C] font-ibm uppercase">{probability.toFixed(0)}%</span>
      </div>
    </div>
  );
};

const initialTree: TreeNode = {
  id: 'start',
  content: '',
  position: { x: 0, y: 0 },
  type: 'action', // Ensure this is one of the NodeType values
  outcomes: []
};

//////////////////////
// FLOWCHART PAGE ////
//////////////////////

const FlowchartPage: React.FC<{ user: { email: string } }> = ({ user }) => {
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
  const [treeData, setTreeData] = useState<TreeNode>(initialTree); // Add this line
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoom = useCallback((direction: 'in' | 'out') => {
    console.log('handleZoom called with direction:', direction);
    setZoom(prevZoom => {
      let newZoom = direction === 'in' ? prevZoom * 1.2 : prevZoom / 1.2;
      console.log('New zoom calculated:', newZoom);
      
      // Ensure we don't zoom out beyond fitting the entire graph
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const parentRect = containerRef.current.parentElement?.getBoundingClientRect();
        
        if (parentRect) {
          const minZoom = Math.min(
            parentRect.width / containerRect.width,
            parentRect.height / containerRect.height
          );
          newZoom = Math.max(newZoom, minZoom);
        }
      }
      
      console.log('Final zoom value:', newZoom);
      return newZoom;
    });
  }, []);

  useEffect(() => {
    console.log('Zoom state updated:', zoom);
  }, [zoom]);

  const [selectedFlowchart, setSelectedFlowchart] = useState<TreeNode | null>(null);

  const supabase = createClientComponentClient();

  const updateTreeData = (newData: TreeNode) => {
    setTreeData(newData);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id');
      if (id) {
        loadFlowchart(id);
      }
    }
  }, []);

  const saveFlowchart = async () => {
    const supabase = createClientComponentClient();
    try {
      const { data, error } = await supabase
        .from('flowcharts')
        .insert([{ 
          user_email: user.email, 
          tree_data: treeData 
        }])
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
      const { data, error } = await supabase
        .from('flowcharts')
        .select('tree_data')
        .eq('id', id)
        .single();

      if (error) throw error;

      setSelectedFlowchart(data.tree_data);
      setActiveView('outcomes'); // Switch to outcomes view to display the loaded flowchart
    } catch (error) {
      console.error('Error loading flowchart:', error);
    }
  };


  const questions = [
    "Set the setting",
    "What action will you take?"
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAnswers = [...answers];
    newAnswers[step] = e.target.value;
    setAnswers(newAnswers);
  };

  const [isLoading, setIsLoading] = useState(false);

  const handleInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        signal: abortControllerRef.current.signal
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

  const debouncedProgressStep = useMemo(
    () => debounce(progressStep, 300),
    [progressStep]
  );

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
      behavior: 'smooth'
    });
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleScrollUp = useCallback(() => {
    console.log('Scroll up button clicked');
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, []);

  return (
    <>
      {isLoading && <LoadingPage />}
      <div className={`md:flex md:h-screen w-screen overflow-y-auto md:overflow-hidden max-w-screen ${chartFullyRendered ? 'md:flex' : 'block'}`}>
        <div className={`h-screen ${chartFullyRendered ? 'w-full md:w-2/6' : 'w-full'} flex flex-col z-20 ${chartFullyRendered ? 'bg-white' : 'bg-[#E8E4DB]'} transition-colors duration-500 relative`}>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <AnimatePresence mode="wait">
              {!isGenerating && !outcomesReady ? (
                <motion.div
                  key={step}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="w-full max-w-sm"
                >
                  
                  <h2 className="text-lg mb-4 text-center uppercase font-mono">{questions[step]}</h2>
                  <form onSubmit={handleInputSubmit}>
                    <input
                      type="text"
                      value={answers[step]}
                      onChange={handleInputChange}
                      className="w-full mb-4 text-center placeholder-center focus:outline-none focus:ring-0 font-man bg-transparent"
                      placeholder="Enter your answer"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSkippedQuestions}
                      className="absolute bottom-5 left-1/2 transform -translate-x-1/2 flex items-center justify-center px-4 py-2 bg-[#3C3C3C] text-black font-man bg-[#E8E4DB] border border-[1px] border-black hover:bg-[#3C3C3C] hover:text-white"
                    >
                      Skip Questions
                    </button>
                  </form>
                </motion.div>
              ) : showSpline ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-center w-full h-full bg-[#E8E4DB] flex items-center justify-center text-center"
                >
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                    className="flex items-center justify-center"
                  >
                    <Spline
                      scene="https://prod.spline.design/gbG6-0xtiOTPHBfn/scene.splinecode" 
                    />
                  </motion.div>
                </motion.div>
            ) : chartFullyRendered ? (
              <AnimatePresence mode="wait">
                {activeView === 'profile' && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center w-full"
                  >
                    <h2 className="text-lg mb-2 font-ibm uppercase text-[#3C3C3C]">PROFILE</h2>
                    <h2 className="text-lg mb-2 font-man text-gray-500">{user.email}</h2>
                    <LogoutButton/>
                  </motion.div>
                )}
            
                {activeView === 'outcomes' && (
                  <motion.div
                    key="outcomes"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center w-full"
                  >
                    <div className="mb-4">
                      <span className="text-6xl font-bold font-ibm text-[#3C3C3C]">
                        <Counter value={numberOfOutcomes} />
                        {`${numberOfOutcomes}`}
                      </span>
                    </div>
                    <h2 className="text-lg mb-2 font-ibm uppercase text-[#3C3C3C]">Possible outcomes generated</h2>
                    <p className='font-man text-gray-500 mb-4'>Interact with the flowchart.</p>
                    <div className="flex justify-center md:hidden">
                      <button
                        onClick={scrollToFlowchart}
                        className="w-8 h-8 bg-[#3C3C3C] text-white flex items-center justify-center hover:bg-[#4C4C4C] transition-colors duration-200"
                        aria-label="Scroll to flowchart"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      </button>
                    </div>
                  </motion.div>
                )}
            
            {activeView === 'history' && (
      <motion.div
        key="history"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="w-full"
      >
        <History onLoadFlowchart={loadFlowchart} />
      </motion.div>
    )}

              </AnimatePresence>
              ) : null}
            </AnimatePresence>
          </div>
          
          {chartFullyRendered && (
            <div className="absolute bottom-4 left-4 flex font-man">
                 <button
                onClick={() => setActiveView('outcomes')}
                className={`px-4 py-0 mr-2 ${activeView === 'outcomes' ? 'bg-[#3C3C3C] text-white' : 'bg-white text-[#3C3C3C]'} border border-[#3C3C3C]`}
              >
               Graph
              </button>
              <button
                onClick={() => setActiveView('history')}
                className={`px-4 py-0 mr-2 ${activeView === 'history' ? 'bg-[#3C3C3C] text-white' : 'bg-white text-[#3C3C3C]'} border border-[#3C3C3C]`}
              >
                History
              </button>
              <button
                onClick={() => setActiveView('profile')}
                className={`px-4 py-1 mr-2 ${activeView === 'profile' ? 'bg-[#3C3C3C] text-white' : 'bg-white text-[#3C3C3C]'} border border-[#3C3C3C]`}
              >
                Profile
              </button>
            
              <div className="fixed bottom-4 right-4 flex space-x-2 z-10">
                <button
                  onClick={() => handleZoom('in')}
                  className="bg-white text-black px-3 py-0 hover:bg-gray-100 border border-[1px] border-black"
                >
                  +
                </button>
                <button
                  onClick={() => handleZoom('out')}
                  className="bg-white text-black px-3 py-0 hover:bg-gray-100 border border-[1px] border-black"
                >
                  -
                </button>
                <button
                  onClick={handleRefresh}
                  className="bg-white text-black px-2 py-0 hover:bg-gray-100 border border-[1px] border-black flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={handleScrollUp}
                  className="bg-white text-black px-2 py-0 hover:bg-gray-100 border border-[1px] border-black flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>
              </div>
              <button
                onClick={saveFlowchart}
                className="px-4 py-0 bg-[#00B9F9] text-black rounded-md border broder-[1px] border-black"
              >
                Save
              </button>
            </div>
          )}
        </div>
        {showChart && (
          <div className="h-screen w-full md:w-4/6 transition-all duration-500 relative">
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

//////////////////////
// FULL SCREEN POPUP //
//////////////////////

const FullScreenPopup: React.FC<FullScreenPopupProps> = ({ node, onClose }) => {
  const createMarkup = (html: string) => ({ __html: DOMPurify.sanitize(html) });

  return (
    <div className="fixed top-0 left-0 w-full h-full md:w-4/6 md:left-auto md:right-0 bg-[#E8E4DB] shadow-lg z-50 flex flex-col p-4 md:p-12 overflow-y-auto">
      <div className="flex justify-between items-start px-2 md:px-5">
        <div className='flex flex-col'>
          <h2 className="text-xl md:text-2xl mb-2 font-semibold">{node.probability}% {node.title}</h2>
          <p className="text-md md:text-lg text-gray-500 uppercase font-ibm">Option {node.optionNumber}</p>
        </div>
        <button
          onClick={onClose}
          className="text-2xl font-bold hover:text-gray-700"
        >
          &times;
        </button>
      </div>
      <div className="flex-grow mt-6 md:mt-12 px-2 md:px-5 md:pr-28">
        <h3 className="text-md md:text-lg font-ibm uppercase mb-3">WHY IS THIS?</h3>
        <div 
          className="text-sm md:text-md font-man leading-relaxed [&_a]:text-blue-600 [&_a]:underline [&_a]:hover:text-blue-800"
          dangerouslySetInnerHTML={createMarkup(node.content)}
        />
      </div>
    </div>
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
    outcomes: []  // This should now be correctly typed
  });

  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [editingNode, setEditingNode] = useState('start');
  const [selectedNodeDetail, setSelectedNodeDetail] = useState(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popupNode, setPopupNode] = useState<PopupNode | null>(null);

  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 100;
  const INITIAL_HORIZONTAL_SPACING = 300;
  const HORIZONTAL_SPACING = 550;
  const VERTICAL_SPACING = 150;

  const [isInitialLoading, setIsInitialLoading] = useState(false);

  const generateOutcomes = useCallback(async (parentX: number, parentY: number, action: string, isInitial: boolean = false): Promise<TreeNode[]> => {
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
          y: startY + i * VERTICAL_SPACING
        },
        type: 'outcome',
        outcomes: []  // This should now be correctly typed
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
  }, [updateNumberOfOutcomes, VERTICAL_SPACING, HORIZONTAL_SPACING]);

  const generateInitialFlowchart = useCallback(async (situation: string, action: string) => {
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
          y: situationY + (index - (outcomes.length - 1) / 2) * VERTICAL_SPACING
        },
        type: 'outcome',
        outcomes: []
      }))
    };
    setTreeData(initialTree);
    updateTreeData(initialTree); // Add this line to update the parent component's tree data
  }, [generateOutcomes, VERTICAL_SPACING, INITIAL_HORIZONTAL_SPACING, updateTreeData]); // Add updateTreeData to dependencies


  useEffect(() => {
    if (showChart) {
      generateInitialFlowchart(initialSituation, initialAction).then(() => {
        onChartRendered();
      });
    }
  }, [showChart, initialSituation, initialAction, onChartRendered]);

  const handleNodeClick = useCallback((nodeId: string, event: React.MouseEvent) => {
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
  }, [treeData]);

  const handleNodeDoubleClick = useCallback((nodeId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const clickedNode = findNodeById(treeData, nodeId);
    if (clickedNode && clickedNode.type === 'outcome') {
      setTreeData(prevTree => {
        const newTree = JSON.parse(JSON.stringify(prevTree)) as TreeNode;
        const parentPath = getNodePath(newTree, nodeId);
        if (parentPath === null) return prevTree;
  
        const parentNodePath = parentPath.slice(0, -1);
        const parentNode = getNodeByPath(newTree, parentNodePath);
        
        if (!parentNode) return prevTree;
  
        parentNode.outcomes.forEach(outcome => {
          outcome.outcomes = [];
        });
        
        const updateNode = (node: TreeNode): boolean => {
          if (node.id === nodeId) {
            const newAction: TreeNode = {
              id: `action-${Date.now()}`,
              content: '',
              position: {
                x: node.position.x + HORIZONTAL_SPACING,
                y: node.position.y
              },
              type: 'action',
              outcomes: []  // This should now be correctly typed
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
  }, [treeData, HORIZONTAL_SPACING]);


  const handleExpandClick = useCallback((nodeId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const clickedNode = findNodeById(treeData, nodeId);
    if (clickedNode && clickedNode.type === 'outcome') {
      const popupData: PopupNode = {
        probability: clickedNode.probability ?? 0, // Provide a default value if undefined
        title: clickedNode.title ?? '', // Provide a default value if undefined
        optionNumber: clickedNode.optionNumber ?? 0, // Provide a default value if undefined
        content: clickedNode.content
      };
      setPopupNode(popupData);
    }
  }, [treeData]);

  const handleNodeDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = findNodeById(treeData, nodeId);
    if (node) {
      setIsDragging(true);
      setDraggedNode(nodeId);
      setDragOffset({
        x: e.clientX - node.position.x,
        y: e.clientY - node.position.y
      });
    }
  }, [treeData]);

  const handleNodeDrag = useCallback((e: MouseEvent) => {
    if (!isDragging || !draggedNode) return;
  
    setTreeData(prevTree => {
      const newTree = JSON.parse(JSON.stringify(prevTree));
      const updateNodePosition = (node: TreeNode): boolean => {
        if (node.id === draggedNode) {
          node.position = {
            x: e.clientX - dragOffset.x,
            y: e.clientY - dragOffset.y
          };
          return true;
        }
        return node.outcomes.some(updateNodePosition);
      };
      
      updateNodePosition(newTree);
      updateTreeData(newTree); // Add this line
      return newTree;
    });
  }, [isDragging, draggedNode, dragOffset, updateTreeData]);

  const handleNodeDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedNode(null);
  }, []);

  const handleActionSubmit = useCallback(async (nodeId: string, content: string) => {
    try {
      const node = findNodeById(treeData, nodeId);
      if (!node) return;
  
      const outcomes = await generateOutcomes(node.position.x, node.position.y, content);
      
      setTreeData(prevTree => {
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
  }, [treeData, generateOutcomes, updateTreeData]);


  const renderNode = (node: TreeNode, depth: number = 0, path: number[] = []): React.ReactNode => {
    if (!node) return null;
    const hasOutcomes = node.outcomes && node.outcomes.length > 0;
    const isSelected = JSON.stringify(path) === JSON.stringify(selectedPath);
    const isOnSelectedPath = selectedPath.length >= path.length && 
      JSON.stringify(path) === JSON.stringify(selectedPath.slice(0, path.length));
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
              <svg className="absolute" style={{ left: '0', top: '0', width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
                {node.outcomes.map((outcome: TreeNode, index: number) => {
                  const isOutcomeSelected = selectedPath.length > path.length && 
                                            selectedPath[path.length] === index;
                  const startX = 0;
                  const startY = node.position.y + NODE_HEIGHT / 2;
                  const endX = outcome.position.x;
                  const endY = outcome.position.y + NODE_HEIGHT / 2;
                  const midX = (startX + endX) / 2;
  
                  return (
                    <path
                      key={outcome.id}
                      d={`M ${startX},${startY} C ${midX},${startY} ${midX},${endY} ${endX},${endY}`}
                      fill="none"
                      stroke={isOutcomeSelected ? "black" : "gray"}
                      strokeWidth={isOutcomeSelected ? "2" : "1"}
                    />
                  );
                })}
              </svg>
              {node.outcomes.map((outcome: TreeNode, index: number) => renderNode(outcome, depth + 1, [...path, index]))}
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
        className={`absolute p-2 py-2 px-4 cursor-pointer text-wrap w-[20em] h-[5em] uppercase text-center font-normal ${nodeBackgroundColor} ${nodeBorderClass}`}
          style={{
            ...solidShadowStyle,  // Apply the solid shadow style here
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
            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const actionInput = form.elements.namedItem('action') as HTMLInputElement;
              if (actionInput) {
                handleActionSubmit(node.id, actionInput.value);
              }
            }} className="w-full h-full">
              <input
                name="action"
                defaultValue={node.content}
                className={`w-full h-full p-2 text-center text-white font-mono uppercase text-center text-sm text-wrap ${nodeBackgroundColor} outline-none`}
                autoFocus
              />
            </form>
          ) : (
            <>
            <div className="w-full flex-grow flex items-center justify-between ">
            {node.type === 'outcome' && (
        <div className="w-16 h-16 font-medium">
        <Component 
  probability={node.probability ?? 0} // Use nullish coalescing operator to provide a default value
  index={path[path.length - 1] ?? 0} // Also provide a default for index
  isSelected={isSelected || isOnSelectedPath}
/>
        </div>
              )}
              <div className="flex-grow text-sm overflow-hidden text-black">
                <div className="text-ellipsis overflow-hidden font-ibm">
                  {node.type === 'action' ? node.content : node.title}
                </div>
              </div>
              {node.type === 'outcome' && (
                <button 
                  className={`flex-shrink-0 text-xl ${isSelected ? 'bg-[#00B7FC] hover:bg-[#00A6E5]' : 'hover:bg-[#DCA7D6]'} pl-2 pr-2 text-black transition-colors duration-200`}
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
            <svg className="absolute" style={{ left: '0', top: '0', width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
              {node.outcomes.map((outcome, index) => {
                const isOutcomeSelected = selectedPath.length > path.length && 
                                          selectedPath[path.length] === index;
                const startX = node.position.x + 320;
                const startY = node.position.y + NODE_HEIGHT / 2;
                const endX = outcome.position.x;
                const endY = outcome.position.y + NODE_HEIGHT / 2;
                const midX = (startX + endX) / 2;

                return (
                  <motion.path
                  key={outcome.id}
                  d={`M ${startX},${startY} C ${midX},${startY} ${midX},${endY} ${endX},${endY}`}
                  fill="none"
                  stroke={isOutcomeSelected ? "black" : "#C2BEB5"}
                  strokeWidth={isOutcomeSelected ? "3" : "2"}
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
      <div className="h-full w-full relative bg-[#E8E4DB] overflow-auto">
        <div 
          ref={containerRef}
          style={containerStyle}
          className="relative min-h-full"
          key={JSON.stringify(treeData)}
        >
          {renderNode(treeData)}
        </div>
        {popupNode && (
          <FullScreenPopup 
            node={popupNode} 
            onClose={() => setPopupNode(null)}
          />
        )}
      </div>
    </>
  );
};

export default withAuth(FlowchartPage);