import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { longestWindowCases } from '../../../challenges/longest-window/cases';
import { longestWindowChallenge } from '../../../challenges/longest-window/metadata';
import { longestWindow } from '../../../challenges/longest-window/solution';
import ExampleExplorer from './ExampleExplorer.vue';

describe('ExampleExplorer', () => {
  function mountExplorer() {
    return mount(ExampleExplorer, {
      props: {
        cases: longestWindowCases,
        exampleCaseIds: longestWindowChallenge.exampleCaseIds,
        demonstrate: ({ events, k }) => longestWindow([...events], k),
      },
    });
  }

  it('starts from the documented tie example and labels the canonical output clearly', () => {
    const wrapper = mountExplorer();

    expect((wrapper.get('#example-events-json').element as HTMLTextAreaElement).value)
      .toBe('[\n  "A",\n  "B",\n  "A",\n  "C",\n  "B",\n  "B"\n]');
    expect((wrapper.get('input[aria-label="Maximum distinct identifiers"]').element as HTMLInputElement).value).toBe('2');
    expect(wrapper.get('[data-testid="example-output"]').text()).toBe('{ start: 0, endExclusive: 3 }');
    expect(wrapper.text()).toMatch(/canonical reference for these example inputs/i);
    expect(wrapper.text()).not.toMatch(/your code passed|tests passed/i);
  });

  it('validates JSON string arrays and finite numeric limits accessibly', async () => {
    const wrapper = mountExplorer();
    const events = wrapper.get('#example-events-json');

    await events.setValue('["A", 2]');
    expect(wrapper.get('[role="alert"]').text()).toMatch(/array of strings/i);
    expect(events.attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('input[aria-label="Maximum distinct identifiers"]').attributes('aria-invalid')).toBe('false');

    await events.setValue('["A"]');
    const limit = wrapper.get('input[aria-label="Maximum distinct identifiers"]');
    await limit.setValue('Infinity');
    expect(wrapper.get('[role="alert"]').text()).toMatch(/finite number/i);
    expect(limit.attributes('aria-invalid')).toBe('true');
  });

  it('uses fractional and large limits with the same semantics as the canonical cases', async () => {
    const wrapper = mountExplorer();
    await wrapper.get('#example-events-json').setValue('["A", "B", "A"]');

    await wrapper.get('input[aria-label="Maximum distinct identifiers"]').setValue('1.5');
    expect(wrapper.get('[data-testid="example-output"]').text()).toBe('{ start: 0, endExclusive: 1 }');

    await wrapper.get('input[aria-label="Maximum distinct identifiers"]').setValue('0.5');
    expect(wrapper.get('[data-testid="example-output"]').text()).toBe('{ start: 0, endExclusive: 0 }');

    await wrapper.get('input[aria-label="Maximum distinct identifiers"]').setValue('1000000');
    expect(wrapper.get('[data-testid="example-output"]').text()).toBe('{ start: 0, endExclusive: 3 }');
  });

  it('rejects inputs larger than the documented maximum before calling the demonstrator', async () => {
    const demonstrate = vi.fn(({ events }: { events: string[]; k: number }) => longestWindow(events, 1));
    const wrapper = mount(ExampleExplorer, {
      props: {
        cases: longestWindowCases,
        exampleCaseIds: longestWindowChallenge.exampleCaseIds,
        demonstrate,
      },
    });
    demonstrate.mockClear();

    await wrapper.get('#example-events-json').setValue(JSON.stringify(Array.from({ length: 100_001 }, () => 'A')));

    expect(wrapper.get('[role="alert"]').text()).toMatch(/no more than 100,000/i);
    expect(demonstrate).not.toHaveBeenCalled();
  });

  it('loads the canonical Unicode and empty-string fixtures through the shared example selector', async () => {
    const wrapper = mountExplorer();

    await wrapper.get('select[aria-label="Example preset"]').setValue('unicode-identifiers');
    expect(wrapper.get('[data-testid="example-output"]').text()).toBe('{ start: 0, endExclusive: 3 }');

    await wrapper.get('select[aria-label="Example preset"]').setValue('empty-string-identifier');
    expect((wrapper.get('#example-events-json').element as HTMLTextAreaElement).value)
      .toBe('[\n  "",\n  "A",\n  "",\n  "B"\n]');
    expect(wrapper.get('[data-testid="example-output"]').text()).toBe('{ start: 0, endExclusive: 3 }');
  });
});
