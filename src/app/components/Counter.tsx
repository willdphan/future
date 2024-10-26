import React from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';

const Counter: React.FC<CounterProps> = ({ value }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, latest => Math.round(latest));

  React.useEffect(() => {
    const animation = animate(count, value, { duration: 1 });
    return animation.stop;
  }, [value, count]);

  return <motion.div></motion.div>;
};

export default Counter;