import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { AdviceState, Market, ScanResult } from '@domain/api';
import { AdvicePanel } from '../components/AdvicePanel';
import { CtaBanner } from '../components/CtaBanner';
import { Footer, Header } from '../components/Chrome';
import { FindingsPanel, type Filter } from '../components/FindingsPanel';
import { GroupCard } from '../components/GroupCard';
import { ScoreHelp } from '../components/ScoreHelp';
import { SourcesPanel } from '../components/SourcesPanel';
import { ScoreHero } from '../components/ScoreHero';
import { DISCLAIMER, MARKET_LABEL } from '../copy';

interface Props {
  url: string;
  market?: Market;
  result: ScanResult;
  advice?: AdviceState;
  onRestart: () => void;
}

export function Result({ url, market, result, advice, onRestart }: Props) {
  const { report, score } = result;
  const [filter, setFilter] = useState<Filter>('all');
  const issues = score.groups.reduce((n, g) => n + g.issues, 0);
  const select = (key: Filter): void => {
    setFilter(key);
    document.getElementById('findings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <Header tone="light" />
      <main className="container result">
        <div className="result-bar">
          <div className="result-bar__id">
            <span className="eyebrow">Report for</span>
            <span className="result-bar__url">{report.target || url}</span>
          </div>
          <div className="result-bar__meta">
            {market && <span className="badge badge--brand">{MARKET_LABEL[market]}</span>}
            {report.platform !== 'unknown' && <span className="badge badge--upper">{report.platform}</span>}
            <span className="badge">{Math.round(report.durationMs / 1000)}s scan</span>
            <button className="btn btn--secondary" onClick={onRestart}><RotateCcw size={16} aria-hidden />Scan another store</button>
          </div>
        </div>

        <ScoreHero score={score} phases={report.phases} issues={issues} />

        <div className="groups">
          {score.groups.map((g) => (
            <GroupCard key={g.key} group={g} selected={filter === g.key} onSelect={() => select(filter === g.key ? 'all' : g.key)} />
          ))}
        </div>

        <AdvicePanel state={advice} url={report.target || url} />

        <ScoreHelp />
        <CtaBanner tracking={score.groups.find((g) => g.key === 'tracking')} partial={score.partial} />
        <FindingsPanel report={report} groups={score.groups} filter={filter} onFilter={setFilter} />
        <SourcesPanel report={report} />
        <p className="disclaimer">{DISCLAIMER}</p>
      </main>
      <Footer />
    </>
  );
}
