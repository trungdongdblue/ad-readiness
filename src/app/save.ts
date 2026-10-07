import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Capture, Report } from '../domain/types';

export const slugify = (url: string): string => url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 80);

export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2));
}

export const reportPath = (dir: string, url: string): string => join(dir, `${slugify(url)}.json`);
export const rawPath = (dir: string, url: string): string => join(dir, 'raw', `${slugify(url)}.json`);

/** Raw capture for protocol discovery. Large: never read it into an AI context; open it yourself. */
export async function saveRaw(dir: string, url: string, capture: Capture): Promise<string> {
  const p = rawPath(dir, url);
  await writeJson(p, capture);
  return p;
}

export async function saveReport(dir: string, report: Report): Promise<string> {
  const p = reportPath(dir, report.target);
  await writeJson(p, report);
  return p;
}
