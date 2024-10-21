import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export const PieGraph: React.FC<ComponentProps> = ({ probability, index, isSelected }) => {
  const data = [
    { name: 'Probability', value: probability },
    { name: 'Remaining', value: 100 - probability },
  ];

  const nodeWidth = Math.max(20, probability.toFixed(0).length * 10);

  return (
    <div className={`relative w-${nodeWidth} h-16`}>
      <ResponsiveContainer width='100%' height='100%'>
        <PieChart>
          <Pie
            data={data}
            cx='50%'
            cy='50%'
            outerRadius='100%'
            innerRadius='0%'
            dataKey='value'
            startAngle={90}
            endAngle={-270}
            stroke='none'
          >
            <Cell fill={isSelected ? '#009BD6' : '#DCA7D6'} />
            <Cell fill='transparent' />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className='absolute inset-0 flex items-center justify-center'>
        <span className='font-ibm text-lg uppercase text-[#3C3C3C]'>{probability.toFixed(0)}%</span>
      </div>
    </div>
  );
};
