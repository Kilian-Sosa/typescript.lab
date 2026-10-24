import { createSupervisor, type WorkerPort } from './supervisor';

const parentOrigin = import.meta.env.VITE_RUNNER_PARENT_ORIGIN;
if (
  parent !== window &&
  parentOrigin &&
  location.origin === import.meta.env.VITE_RUNNER_ORIGIN &&
  location.origin !== parentOrigin
) {
  const supervisor = createSupervisor({
    parent,
    parentOrigin,
    send: (message) => parent.postMessage(message, parentOrigin),
    createWorker: () => {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      const port: WorkerPort = {
        onmessage: null,
        onerror: null,
        onmessageerror: null,
        postMessage: (payload) => worker.postMessage(payload),
        terminate: () => worker.terminate(),
      };
      worker.onmessage = (event) => port.onmessage?.(event);
      worker.onerror = (event) => {
        event.preventDefault();
        port.onerror?.();
      };
      worker.onmessageerror = () => port.onmessageerror?.();
      return port;
    },
  });
  const receive = (event: MessageEvent<unknown>) => supervisor.receive(event);
  window.addEventListener('message', receive);
  window.addEventListener(
    'pagehide',
    () => {
      window.removeEventListener('message', receive);
      supervisor.dispose();
    },
    { once: true },
  );
  parent.postMessage({ protocol: 1, kind: 'ready' }, parentOrigin);
}
