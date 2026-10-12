import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { setOpsStore } from '../ops/data/store';

// The first console render evaluates the 1.9 MB Bushido bundle, which takes a few seconds in jsdom.
configure({ asyncUtilTimeout: 10_000 });

// Bushido loads icon chunks over the network; tests render the empty placeholder instead.
vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })));

class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

// pdf.js needs a real canvas; component tests check the viewer chrome, not the drawing.
vi.mock('../ops/files/pdf', () => ({
  openPdf: vi.fn(async () => ({ numPages: 1, getPage: () => new Promise(() => {}), loadingTask: { destroy: async () => {} } })),
  closePdf: vi.fn(async () => {}),
  countPages: vi.fn(async () => 1)
}));

beforeEach(() => setOpsStore(null));

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
