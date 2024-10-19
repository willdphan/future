/*
NODE POPUP DETAIL

Functional component that displays detailed information about a specific node in a full-screen overlay. 

The popup displays the following information from the node prop:
• Probability percentage
• Title
• Option number
• Detailed content
*/

import DOMPurify from 'dompurify';

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

export default function FullScreenPopup({ node, onClose }: FullScreenPopupProps) {
  const createMarkup = (html: string) => ({ __html: DOMPurify.sanitize(html) });

  return (
    <div className='fixed left-0 top-0 z-50 flex h-full w-full flex-col overflow-y-auto bg-[#E8E4DB] p-4 md:left-auto md:right-0 md:w-4/6 md:p-12'>
      <div className='flex items-start justify-between px-2 md:px-5'>
        <div className='flex flex-col'>
          <h2 className='mb-2 text-xl font-semibold md:text-2xl'>
            {node.probability}% {node.title}
          </h2>
          <p className='text-md font-ibm uppercase text-gray-500 md:text-lg'>Option {node.optionNumber}</p>
        </div>
        <button onClick={onClose} className='text-2xl font-bold hover:text-gray-700'>
          &times;
        </button>
      </div>
      <div className='mt-6 flex-grow px-2 md:mt-12 md:px-5 md:pr-28'>
        <h3 className='text-md mb-3 font-ibm font-semibold uppercase md:text-lg'>WHY IS THIS?</h3>
        <div
          className='text-md md:text-md font-man leading-relaxed [&_a]:text-blue-600 [&_a]:underline [&_a]:hover:text-blue-800'
          dangerouslySetInnerHTML={createMarkup(node.content)}
        />
      </div>
    </div>
  );
}
