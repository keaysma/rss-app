import type { MessagePayload, MessageResponse, WorkerInterface } from './types';

const workerImp = await import('./worker.ts?worker');

export default async function initWorker(onMessage: (message: MessageEvent<MessageResponse>) => void): Promise<WorkerInterface> {
    const worker = new workerImp.default();

    let resolveInitPromise: () => void;
    const initPromise = new Promise<void>((resolve) => {
        resolveInitPromise = resolve;
    });

    worker.addEventListener("message", (event: MessageEvent<MessageResponse>) => {
        console.log('Received message from worker', event.data);
        if (event.data.message === "initialized") {
            resolveInitPromise();
        }

        onMessage(event);
    });

    worker.postMessage({ message: "init" } satisfies MessagePayload);
    await initPromise.then(() => {
        console.log('Worker initialized');
    });

    return worker as WorkerInterface;
};
