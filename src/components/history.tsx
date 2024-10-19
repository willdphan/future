import React, { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface Flowchart {
  id: string;
  user_email: string;
  tree_data: any;
  created_at: string;
}

interface HistoryProps {
  onLoadFlowchart: (id: string) => Promise<void>;
}

const History: React.FC<HistoryProps> = ({ onLoadFlowchart }) => {
  const [flowcharts, setFlowcharts] = useState<Flowchart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchFlowcharts = async () => {
      console.log('Fetching flowcharts...');
      setLoading(true);
      setError(null);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          console.log('User not authenticated');
          setError('User not authenticated');
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('flowcharts')
          .select('id, created_at')
          .eq('user_email', session.user.email)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching flowcharts:', error);
          setError(error.message);
        } else {
          console.log('Fetched flowcharts:', data);
          // Since the data fetched only includes 'id' and 'created_at', we need to ensure that the data type matches the Flowchart interface.
          // We can do this by mapping over the data and adding the missing properties with default values.
          const formattedData = data.map((item: any) => ({
            ...item,
            user_email: '', // Assuming an empty string as a default value for user_email
            tree_data: {}, // Assuming an empty object as a default value for tree_data
          }));
          setFlowcharts(formattedData);
        }
      } catch (err) {
        console.error('Exception when fetching flowcharts:', err);
        setError('An error occurred while fetching flowcharts');
      } finally {
        setLoading(false);
      }
    };

    fetchFlowcharts();
  }, [supabase]);

  console.log('Rendering History component, flowcharts:', flowcharts);

  if (loading) return <div className='flex items-center justify-center text-center uppercase'>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

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
                <span className='font-man text-gray-700'>{new Date(flowchart.created_at).toLocaleString()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default History;
