import React, { useEffect, useState } from 'react';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const History: React.FC<HistoryProps> = ({ onLoadFlowchart }) => {
  const [flowcharts, setFlowcharts] = useState<Flowchart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchFlowcharts = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('User not authenticated');
          setLoading(false);
          return;
        }

        // Fetch full flowchart data including tree_data
        const { data, error } = await supabase
          .from('flowcharts')
          .select('*')  // Select all columns including tree_data
          .eq('user_email', session.user.email)
          .order('created_at', { ascending: false });

        if (error) {
          setError(error.message);
        } else {
          setFlowcharts(data);
        }
      } catch (err) {
        setError('An error occurred while fetching flowcharts');
      } finally {
        setLoading(false);
      }
    };

    fetchFlowcharts();
  }, [supabase]);

  return (
    <div className='p-4 text-center'>
      <h2 className='mb-4 font-ibm text-lg uppercase text-black'>Saved Flowcharts</h2>
      {flowcharts.length === 0 ? (
        <p className='font-man text-gray-500'>No saved flowcharts.</p>
      ) : (
        <ul className='space-y-2'>
          {flowcharts.map((flowchart) => (
            <li key={flowchart.id}>
              <button
                onClick={() => onLoadFlowchart(flowchart.id)}
                className='w-full rounded-md border border-black bg-white px-4 py-2 text-left transition-colors duration-200 hover:bg-gray-100'
              >
                <span className='font-man text-gray-700'>
                  {new Date(flowchart.created_at).toLocaleString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default History;
