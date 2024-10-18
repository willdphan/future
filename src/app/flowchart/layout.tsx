import { PropsWithChildren } from 'react';

export default function FlowchartLayout({ children }: PropsWithChildren) {
  return (
    <div>
      <main>
        <div className=''>{children}</div>
      </main>
    </div>
  );
}
