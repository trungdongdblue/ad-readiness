import type { ReactNode } from 'react';

export function Header({ tone, children }: { tone: 'light' | 'dark'; children?: ReactNode }) {
  return (
    <div className="container">
      <header className={`site-header site-header--${tone}`}>
        <a className="brand" href="/" aria-label="Ecomdy home">
          Ecomdy<span className="brand__tag">Ads Readiness</span>
        </a>
        {children}
      </header>
    </div>
  );
}

export const Footer = () => (
  <footer className="site-footer">
    <div className="container">Ecomdy Ads Readiness Grader. Scans are read-only: no orders, no data entry, no events sent to TikTok.</div>
  </footer>
);
