import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { longestWindowCases } from '../../../challenges/longest-window/cases';
import type { RunResult } from '../../../shared/contracts/v1';
import { runChallengeKey } from './session';
import type { RunChallenge, RunContext } from './runChallenge';
import RunnerControls from './RunnerControls.vue';
import CodeEditor from './CodeEditor.vue';

function fixture() {
  let finish!: (result: RunResult) => void;
  let active!: RunContext;
  const run = vi.fn<RunChallenge>((_source, _id, context) => {
    active = context;
    return new Promise(resolve => { finish = resolve; });
  });
  const wrapper = mount(RunnerControls, { attachTo: document.body, props: { source: 'exact unsaved source\n', challengeId: 'longest-window', challengeVersion: '1.0.0', resetKey: 0 },
    global: { provide: { [runChallengeKey as symbol]: run } } });
  const reply = (status: RunResult['status'], reason?: RunResult['reason'], consoleOutput?: unknown) => finish({ contractVersion: '1.0.0',
    ...active, challengeId: 'longest-window', status, diagnostics: ['Readable diagnostic <script>'], ...(reason ? { reason } : {}),
    ...(consoleOutput ? { consoleOutput } : {}),
    cases: longestWindowCases.map(c => ({ caseId: c.id, status: status === 'passed' ? 'passed' : status === 'failed' ? 'failed' : 'not-run',
      ...(status === 'passed' || status === 'failed' ? { expected: c.expected, actual: status === 'passed' ? c.expected : null } : {}) })) });
  return { wrapper, run, reply };
}

describe('editor and accessible results', () => {
  const logs = { truncated: true, entries: [{ sequence: 0, caseId: longestWindowCases[0]!.id, level: 'warn', text: '<img src=x onerror=alert(1)> 😀' }] };
  it('labels a separate plain-text Console with current run identity and truncation', async () => {
    const f = fixture();
    expect(f.wrapper.get('section[aria-label="Console output"]').text()).toContain('Run tests to capture');
    await f.wrapper.get('button[aria-label="Run tests"]').trigger('click');
    expect(f.wrapper.get('section[aria-label="Console output"]').text()).toContain('available when this run finishes');
    f.reply('execution-error', 'runtime-error', logs); await flushPromises();
    const panel = f.wrapper.get('section[aria-label="Console output"]');
    expect(panel.text()).toContain('warn'); expect(panel.text()).toContain(logs.entries[0]!.text);
    expect(panel.find('img').exists()).toBe(false);
    expect(panel.text()).toContain(f.run.mock.calls[0]![2].runId);
    expect(panel.text()).toContain('Revision 0'); expect(panel.text()).toContain('execution-error');
    expect(panel.text()).toContain('truncated'); expect(panel.text()).not.toContain('Readable diagnostic');
    expect(panel.get('[tabindex="0"]').attributes('aria-label')).toBe('Console messages');
    expect(panel.get('[aria-live="polite"]').text()).toContain('1 console message');
    f.wrapper.unmount();
  });
  it('clears console on edits, account reset and next run, and distinguishes absent/empty capture', async () => {
    const f = fixture(); await f.wrapper.get('button[aria-label="Run tests"]').trigger('click');
    f.reply('passed', undefined, logs); await flushPromises();
    await f.wrapper.get('button[aria-label="Run tests"]').trigger('click');
    expect(f.wrapper.text()).not.toContain(logs.entries[0]!.text);
    f.reply('passed', undefined, { entries: [], truncated: false }); await flushPromises();
    expect(f.wrapper.text()).toContain('No console messages');
    await f.wrapper.setProps({ source: 'new revision' });
    expect(f.wrapper.get('section[aria-label="Console output"]').text()).toContain('cleared');
    await f.wrapper.get('button[aria-label="Run tests"]').trigger('click'); f.reply('passed', undefined, logs); await flushPromises();
    await f.wrapper.setProps({ resetKey: 1 }); expect(f.wrapper.text()).not.toContain(logs.entries[0]!.text);
    await f.wrapper.get('button[aria-label="Run tests"]').trigger('click'); f.reply('infrastructure-error'); await flushPromises();
    expect(f.wrapper.text()).toContain('Console output is unavailable'); f.wrapper.unmount();
  });
  it('immediately cancels and cannot restore logs or a pass from a delayed runner', async () => {
    const f = fixture(); await f.wrapper.get('button[aria-label="Run tests"]').trigger('click');
    await f.wrapper.get('button[aria-label="Cancel test run"]').trigger('click');
    expect(f.wrapper.text()).toContain('Run cancelled');
    f.reply('passed', undefined, logs); await flushPromises();
    expect(f.wrapper.text()).not.toContain('All 14 tests passed'); expect(f.wrapper.text()).not.toContain(logs.entries[0]!.text);
    expect(f.wrapper.get('section[aria-label="Console output"]').text()).toContain('cleared'); f.wrapper.unmount();
  });
  afterEach(() => vi.unstubAllGlobals());
  it('can allocate a run on the local HTTP test sites without randomUUID', async () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const f = fixture(); await f.wrapper.get('button[aria-label="Run tests"]').trigger('click');
    expect(f.run).toHaveBeenCalledOnce();
    f.reply('passed'); await flushPromises();
  });
  it('labels the editor and emits exact text without trapping Tab', async () => {
    const editor = mount(CodeEditor, { props: { modelValue: 'source' } });
    await editor.get('textarea').setValue('  exact\nsource\t');
    expect(editor.emitted('update:modelValue')![0]).toEqual(['  exact\nsource\t']);
    expect(editor.get('label').attributes('for')).toBe(editor.get('textarea').attributes('id'));
    expect(editor.get('textarea').attributes('aria-describedby')).toContain('source-help');
    expect((await editor.get('textarea').trigger('keydown', { key: 'Tab' }))).toBeUndefined();
  });

  it.each([
    ['passed', 'All 14 tests passed'], ['failed', 'Tests failed'], ['compile-error', 'Compilation failed'],
    ['timeout', 'Run timed out'], ['execution-error', 'Execution failed'], ['infrastructure-error', 'Runner unavailable'],
  ] as const)('renders %s with a polite live status and no focus movement', async (status, title) => {
    const f = fixture();
    expect(f.wrapper.text()).toContain('Tests have not run');
    await f.wrapper.get('button[aria-label="Run tests"]').trigger('click');
    expect(f.run.mock.calls[0]![0]).toBe('exact unsaved source\n');
    expect(f.wrapper.get('[role="status"]').text()).toContain('Running tests');
    expect(f.wrapper.get('button[aria-label="Run tests"]').attributes('disabled')).toBeUndefined();
    expect(f.wrapper.get('button[aria-label="Run tests"]').attributes('aria-disabled')).toBe('true');
    f.reply(status); await flushPromises();
    expect(f.wrapper.get('[role="status"]').text()).toContain(title);
    expect(f.wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite');
    expect(f.wrapper.find('script').exists()).toBe(false);
    if (status === 'failed') {
      expect(f.wrapper.text()).toContain('Expected'); expect(f.wrapper.text()).toContain('Actual');
      expect(f.wrapper.findAll('ol li')).toHaveLength(14);
    }
  });

  it('aborts on source changes and discards delayed passes even if the source is restored', async () => {
    const f = fixture(); await f.wrapper.get('button[aria-label="Run tests"]').trigger('click');
    const firstRevision = f.run.mock.calls[0]![2].sourceRevision;
    await f.wrapper.setProps({ source: 'new' });
    expect(f.run.mock.calls[0]![3]!.aborted).toBe(true);
    await f.wrapper.setProps({ source: 'exact unsaved source\n' });
    f.reply('passed'); await flushPromises();
    expect(f.wrapper.text()).not.toContain('All 14 tests passed');
    expect(f.wrapper.text()).toContain('Source changed');
    await f.wrapper.get('button[aria-label="Run tests"]').trigger('click');
    expect(f.run.mock.calls[1]![2].sourceRevision).toBeGreaterThan(firstRevision);
    expect(f.run.mock.calls[1]![2].runId).not.toBe(f.run.mock.calls[0]![2].runId);
    f.reply('passed'); await flushPromises(); expect(f.wrapper.text()).toContain('All 14 tests passed');
    await f.wrapper.setProps({ source: 'changed after pass' });
    expect(f.wrapper.text()).not.toContain('All 14 tests passed');
  });

  it('cancels, retries infrastructure failures and invalidates on account reset/unmount', async () => {
    const f = fixture(); await f.wrapper.get('button[aria-label="Run tests"]').trigger('click');
    (f.wrapper.get('button[aria-label="Cancel test run"]').element as HTMLButtonElement).focus();
    await f.wrapper.get('button[aria-label="Cancel test run"]').trigger('click');
    expect(f.run.mock.calls[0]![3]!.aborted).toBe(true);
    f.reply('execution-error', 'cancelled'); await flushPromises();
    expect(f.wrapper.text()).toContain('Run cancelled');
    expect(document.activeElement).toBe(f.wrapper.get('button[aria-label="Run tests"]').element);
    await f.wrapper.get('button[aria-label="Run tests"]').trigger('click');
    f.reply('infrastructure-error'); await flushPromises();
    expect(f.wrapper.text()).toContain('retry');
    await f.wrapper.get('button[aria-label="Run tests"]').trigger('click');
    await f.wrapper.setProps({ resetKey: 1 }); f.reply('passed'); await flushPromises();
    expect(f.wrapper.text()).not.toContain('All 14 tests passed');
    await f.wrapper.get('button[aria-label="Run tests"]').trigger('click');
    f.wrapper.unmount(); expect(f.run.mock.calls.at(-1)![3]!.aborted).toBe(true);
  });

  it('keeps Run disabled without the local security opt-in', () => {
    const wrapper = mount(RunnerControls, { props: { source: '', challengeId: 'longest-window', challengeVersion: '1.0.0' } });
    expect(wrapper.get('button[aria-label="Run tests"]').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('unavailable on this deployment');
  });
});
