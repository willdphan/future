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
import PieGraph from './PieGraph';
import FullScreenPopup from './FullScreenPopup';
import FlowGraph from './FlowGraph';

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

interface FlowChartPageProps {
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

const FlowChart: React.FC<FlowChartPageProps> = ({ user }) => {
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
            <FlowGraph
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

export default withAuth(FlowChart);
