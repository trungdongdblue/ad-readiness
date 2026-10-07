import { describe, expect, it } from 'vitest';
import { planOptions } from '../src/collectors/option-ai';
import { describeBlock, planSelections, verifyPlan, type Control } from '../src/parsers/options';

const c = (i: number, label: string, over: Partial<Control> = {}): Control => ({ i, kind: 'button', group: 'g0', label, disabled: false, selected: false, ...over });
const sizes = [c(0, 'Size guide'), c(1, 'S', { disabled: true }), c(2, 'M'), c(3, 'L')];

describe('choosing options (layer 1)', () => {
  it('takes the first available option of a group with nothing chosen, never a guide or a sold-out size', () => {
    expect(planSelections(sizes).map((x) => x.label)).toEqual(['M']);
  });
  it('leaves a group alone when something is already chosen, and handles each group', () => {
    const two = [c(0, 'M', { selected: true }), c(1, 'L'), c(2, 'Red', { group: 'g1' }), c(3, 'Blue', { group: 'g1' })];
    expect(planSelections(two).map((x) => x.label)).toEqual(['Red']);
  });
});

describe('what the model may ask for (layer 2)', () => {
  it('keeps real, available options in order and drops everything else', () => {
    expect(verifyPlan([2, 1, 0, 99, 2, 'x', 3], sizes).map((x) => x.label)).toEqual(['M', 'L']);
    expect(verifyPlan('M', sizes)).toEqual([]);
  });
  it('never clicks an action such as Buy now or Subscribe, even when asked', () => {
    const risky = [c(0, 'Buy it now'), c(1, 'Subscribe & save'), c(2, 'Add to wishlist')];
    expect(verifyPlan([0, 1, 2], risky)).toEqual([]);
  });
  it('asks the model once, sends the page text as data, and only returns verified controls', async () => {
    let body = '';
    const fetchImpl = (async (_u: unknown, init: { body: string }) => {
      body = init.body;
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '[3, 7]' }] } }], usageMetadata: {} }));
    }) as unknown as typeof fetch;
    const out = await planOptions(sizes, ['*Please select <b>the size</b>'], { apiKey: 'k', model: 'm', fetchImpl });
    expect(out.map((x) => x.label)).toEqual(['L']);
    expect(body).toContain('untrusted');
    expect(body).not.toContain('<b>');
  });
  it('returns nothing without a key or on failure, so layer 1 and 3 still decide', async () => {
    const failing = (async () => new Response('no', { status: 500 })) as unknown as typeof fetch;
    expect(await planOptions(sizes, [], { apiKey: 'k', model: 'm', fetchImpl: failing })).toEqual([]);
  });
});

describe('why it could not be checked (layer 3)', () => {
  it('says what was tried, what was sold out, or what the store asked for, never "missing"', () => {
    expect(describeBlock(sizes, ['"M"'], [])).toContain('chose "M"');
    expect(describeBlock([c(0, 'S', { disabled: true })], [], [])).toContain('sold out or disabled');
    expect(describeBlock([], [], ['*Please select the size'])).toContain('Please select the size');
    expect(describeBlock([], [], [])).toContain('no cart-add response');
  });
});
