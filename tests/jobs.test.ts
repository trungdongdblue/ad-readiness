import { describe, expect, it } from 'vitest';
import type { Report } from '../src/domain/types';
import { BusyError, createJobs } from '../src/app/jobs';
import { SCAN_FAILED, scanProcessor } from '../src/app/process-scan';
import { memoryQueue, type ScanQueue } from '../src/app/queue';
import type { ScanInput, ScanOutput } from '../src/app/scan-service';
import { memoryStore } from '../src/app/store';

const report = { findings: [{ id: 'pixel.present', title: 'p', status: 'verified', severity: 'info', evidence: [] }, { id: 'mobile.speed', title: 'm', status: 'detected', severity: 'info', evidence: [] }] } as unknown as Report;
const tick = () => new Promise((r) => setTimeout(r, 0));
const ok = (): Promise<ScanOutput> => Promise.resolve({ report, capture: {} } as ScanOutput);

describe('scan processor', () => {
  it('writes the stage while running, then the scored result', async () => {
    const store = memoryStore();
    let finish!: () => void;
    const run = scanProcessor(store, (i: ScanInput) => {
      i.onStage?.('product');
      return new Promise<ScanOutput>((r) => { finish = () => r({ report, capture: {} } as ScanOutput); });
    });
    const done = run({ id: 'j1', url: 'https://a.test/' });
    await tick();
    expect(await store.load('j1')).toMatchObject({ status: 'running', stage: 'product' });
    finish();
    await done;
    const view = await store.load('j1');
    expect(view?.status).toBe('done');
    expect(view?.result?.score.total).toBe(100);
  });

  it('hides internal errors from the customer and does not throw', async () => {
    const store = memoryStore();
    await scanProcessor(store, () => Promise.reject(new Error('playwright: net::ERR_X at 10.0.0.1')))({ id: 'j2', url: 'https://b.test/' });
    expect(await store.load('j2')).toMatchObject({ status: 'failed', error: SCAN_FAILED });
  });

  it('passes the egress proxy to every scan', async () => {
    let seen: string | undefined;
    await scanProcessor(memoryStore(), (i) => { seen = i.proxy; return ok(); }, 'http://egress:3128')({ id: 'j3', url: 'https://c.test/' });
    expect(seen).toBe('http://egress:3128');
  });
});

describe('jobs + queue', () => {
  it('queues the scan, then a worker completes it', async () => {
    const store = memoryStore();
    const jobs = createJobs(store, memoryQueue(scanProcessor(store, ok), 2));
    const id = await jobs.start({ url: 'https://d.test/' });
    await tick();
    expect((await jobs.get(id))?.status).toBe('done');
  });

  it('runs at most `concurrency` scans at once and answers busy past the waiting limit', async () => {
    let active = 0;
    let peak = 0;
    const queue = memoryQueue(async () => { active += 1; peak = Math.max(peak, active); await new Promise(() => {}); }, 2);
    const jobs = createJobs(memoryStore(), queue);
    for (let i = 0; i < 22; i++) await jobs.start({ url: `https://e${i}.test/` }); // 2 running + 20 waiting
    expect(peak).toBe(2);
    await expect(jobs.start({ url: 'https://over.test/' })).rejects.toThrow(BusyError);
  });

  it('a queue that stays full is the only reason for busy', async () => {
    const empty: ScanQueue = { add: async () => {}, waiting: async () => 0 };
    await expect(createJobs(memoryStore(), empty).start({ url: 'https://f.test/' })).resolves.toMatch(/^[0-9a-f-]{36}$/);
  });
});
