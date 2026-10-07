import type { Finding, Rule } from '../../domain/types';
import { unreadable } from '../../parsers/trust';

export const pixelPresent: Rule = (obs) => {
  const ids = [...new Set(obs.pixels.map((p) => p.id))];
  if (ids.length === 0 && obs.consentBannerSeen && !obs.consentClicked) {
    return [{
      id: 'pixel.present', title: 'No Pixel seen, but a cookie banner was not accepted', status: 'unverifiable', severity: 'major', evidence: ['consent banner present'],
      fix: 'Re-scan with consent accepted; many sites load the Pixel only after consent.',
    }];
  }
  // An empty shell, country picker or bot wall has no Pixel because it is not the store: never accuse (hard rule 4).
  if (ids.length === 0 && obs.trust && unreadable(obs.trust)) {
    return [{
      id: 'pixel.present', title: 'Pixel could not be checked: the page did not load as a store', status: 'unverifiable', severity: 'info',
      evidence: ['page content missing, too short or blocked (bot wall, country picker?)'],
      fix: 'Scan a product page URL, or open the store from the target country, then re-scan.',
    }];
  }
  if (ids.length === 0) {
    return [{
      id: 'pixel.present', title: 'TikTok Pixel not found', status: 'missing', severity: 'blocker', evidence: [],
      fix: 'Install the TikTok Pixel (partner integration or base code in <head>) and re-scan.',
    }];
  }
  const onWire = obs.pixels.some((p) => p.source === 'network');
  const out: Finding[] = [{
    id: 'pixel.present', title: `TikTok Pixel found (${ids.join(', ')})`,
    status: onWire ? 'verified' : 'detected', severity: 'info',
    evidence: obs.pixels.map((p) => `${p.source}:${p.id}`),
  }];
  if (ids.length > 1) {
    // Info, not a penalty: two Pixels are legitimate (owner plus agency, different ad accounts) and from outside we cannot tell
    // whether they feed the same account. TikTok recommends one per website (docs/TRACKING-RULES.md).
    out.push({
      id: 'pixel.multiple', title: `More than one TikTok Pixel on the site (${ids.length})`, status: 'detected', severity: 'info',
      evidence: ids, fix: 'TikTok recommends one Pixel per website (more can slow the page). If each is intended, for example one for the store and one for an agency, no action is needed. Remove any you do not recognise.',
    });
  }
  return out;
};

export const pixelSilent: Rule = (obs) => {
  const hasPixel = obs.pixels.length > 0;
  const anyEvent = obs.events.length > 0;
  if (!hasPixel || anyEvent) return [];
  return [{
    id: 'pixel.silent', title: 'Pixel loaded but no events were observed', status: 'detected', severity: 'major',
    evidence: [obs.consentClicked ? 'consent accepted' : 'consent not accepted', `undecoded beacons: ${obs.undecodedBeacons}`],
    fix: 'Check whether a cookie-consent banner blocks the Pixel, then test with TikTok Test Events.',
  }];
};
