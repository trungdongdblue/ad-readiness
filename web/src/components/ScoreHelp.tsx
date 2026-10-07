import { BLOCKER_GROUP_CAP, BLOCKER_TOTAL_CAP, MIN_COVERAGE, PENALTY } from '@engine/score';

/** The scoring rules in words. Numbers come from the engine, so this text cannot drift from the real maths. */
export function ScoreHelp() {
  return (
    <details className="how">
      <summary>How the score works</summary>
      <ul>
        <li>Each of the four groups starts at 100 and loses points for every issue: Blocker {PENALTY.blocker}, Major {PENALTY.major}, Minor {PENALTY.minor}.</li>
        <li>The total is the average of the groups we could check, so a group we could not check never drags you down.</li>
        <li>A missing TikTok Pixel caps Tracking at {BLOCKER_GROUP_CAP} and the total at {BLOCKER_TOTAL_CAP}, because campaigns cannot be measured without it.</li>
        <li>If we could check less than {Math.round(MIN_COVERAGE * 100)}% of the items, the verdict cannot be "Ready to run": the scan is marked partial.</li>
        <li>Anything we cannot see from outside, such as the Purchase event or later checkout steps, is listed as "Could not verify" and never counted against you.</li>
      </ul>
    </details>
  );
}
