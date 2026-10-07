import { useEffect } from 'react';
import { Landing } from './screens/Landing';
import { Result } from './screens/Result';
import { ScanFailed, Scanning } from './screens/Scanning';
import { useScan } from './useScan';

export function App() {
  const { state, submit, reset } = useScan();
  // A new screen starts at the top; each screen moves focus to its own heading for keyboard and screen-reader users.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.kind]);

  switch (state.kind) {
    case 'idle': return <Landing error={state.error} onSubmit={submit} />;
    case 'scanning': return <Scanning state={state} onCancel={reset} />;
    case 'done': return <Result url={state.url} market={state.market} result={state.result} advice={state.advice} onRestart={reset} />;
    case 'failed': return <ScanFailed message={state.message} onRetry={reset} />;
  }
}
