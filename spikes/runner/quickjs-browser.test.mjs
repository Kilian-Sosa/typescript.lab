import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const harness = await import('./quickjs-harness.mjs');

test('QuickJS feasibility harness covers the approved local browser gates', async () => {
  assert.equal(typeof harness.runQuickJsFeasibility, 'function');
  if (typeof harness.runQuickJsFeasibility !== 'function') return;

  const evidence = await harness.runQuickJsFeasibility();
  const evidencePath = fileURLToPath(new URL('./.artifacts/quickjs-evidence.json', import.meta.url));
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(`QuickJS feasibility evidence: ${evidencePath}`);
  assert.equal(evidence.quickjs.version, '0.32.0');
  assert.equal(evidence.q1.currentSourcePassedCanonicalCases, true);
  assert.equal(evidence.q1.semanticTypeMismatchRejected, true);
  assert.equal(evidence.q1.syntaxErrorRejected, true);
  assert.equal(evidence.q1.importRejected, true);
  assert.equal(evidence.q1.runtimeErrorDistinguished, true);
  assert.equal(evidence.q2.workerOnlyQuickJs, true);
  assert.equal(evidence.q2.hostBrowserApisUnavailable, true);
  assert.equal(evidence.q2.expectedValuesExcludedFromVm, true);
  assert.equal(evidence.q2.crossCaseStateReset, true);
  assert.equal(evidence.q3.loopTimedOut, true);
  assert.equal(evidence.q3.expensiveBuiltinHardTerminated, true);
  assert.ok(evidence.q3.loopDurationMs >= 1500);
  assert.equal(evidence.q3.workerFailureDisposed, true);
  assert.equal(evidence.q3.sourceCapped, true);
  assert.equal(evidence.q3.inputCapped, true);
  assert.equal(evidence.q3.caseCountCapped, true);
  assert.ok(evidence.q3.browserResponsiveTicks > 0);
  assert.equal(evidence.q3.memoryCapped, true);
  assert.equal(evidence.q3.stackCapped, true);
  assert.equal(evidence.q3.outputCapped, true);
  assert.equal(evidence.q3.cancelledWorkerDisposed, true);
  assert.equal(evidence.q3.workerFailureDisposed, true);
  assert.equal(evidence.q3.repeatedRunsUseFreshWorkers, true);
  assert.equal(evidence.q3.singleActiveWorkerBurstBounded, true);
  assert.equal(evidence.q3.burstWorkersCreated, 1);
  assert.ok(evidence.q3.burstBusyRejections > 0);
  assert.equal(evidence.q3.workersDisposedAfterBurst, true);
  assert.equal(evidence.q3.boundedRecoveryAfterBurst, true);
  assert.equal(evidence.q4.foreignOriginRejected, true);
  assert.equal(evidence.q4.wrongSourceRejected, true);
  assert.equal(evidence.q4.forgedPassRejected, true);
  assert.equal(evidence.q4.validHandshakeEstablished, true);
  assert.equal(evidence.q4.activeMalformedCaseRejected, true);
  assert.equal(evidence.q4.activeEmptySuiteRejected, true);
  assert.equal(evidence.q4.activePartialSuiteRejected, true);
  assert.equal(evidence.q4.activeDuplicateSuiteRejected, true);
  assert.equal(evidence.q4.activeSparseCasesRejected, true);
  assert.equal(evidence.q4.activeSparseDiagnosticsRejected, true);
  assert.equal(evidence.q4.activeSparseNestedJsonRejected, true);
  assert.deepEqual(evidence.q4.activeSparseArrayStructuredCloneEvidence, {
    casesHolePreserved: true,
    casesAccepted: false,
    diagnosticsHolePreserved: true,
    diagnosticsAccepted: false,
    nestedActualHolePreserved: true,
    nestedActualAccepted: false,
  });
  assert.equal(evidence.q4.activeOversizedResultRejected, true);
  assert.equal(evidence.q4.activeWrongProtocolRejected, true);
  assert.equal(evidence.q4.activeWrongContractVersionRejected, true);
  assert.equal(evidence.q4.activeWrongChallengeRejected, true);
  assert.equal(evidence.q4.activeWrongChallengeVersionRejected, true);
  assert.equal(evidence.q4.activeReplayRejected, true);
  assert.equal(evidence.q4.replyAfterCancellationRejected, true);
  assert.equal(evidence.q4.missingHandshakeRejected, true);
  assert.equal(evidence.q4.invalidHandshakeRejected, true);
  assert.equal(evidence.q4.staleRevisionRejected, true);
  assert.equal(evidence.q4.runMetadataPreserved, true);
  assert.equal(evidence.q4.malformedFrameRejected, true);
  assert.equal(evidence.q5.pageAndWorkerCspEnforced, true);
  assert.equal(evidence.q5.staticWasmLoadedUnderCsp, true);
  assert.equal(evidence.q5.crossSiteCookieStorageIsolated, true);
  assert.equal(evidence.q5.arbitraryNetworkBlocked, true);
  assert.equal(evidence.q6.browser.responsiveDuringTimeout, true);
  assert.equal(evidence.cleanup.workersDisposed, true);
  assert.equal(evidence.cleanup.browserClosed, true);
  assert.equal(evidence.cleanup.serversClosed, true);
});
