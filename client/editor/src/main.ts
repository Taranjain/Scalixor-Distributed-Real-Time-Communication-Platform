import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/min/vs/editor/editor.main.css';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';

export interface EditorInitOptions {
  container: HTMLElement;
  roomId: string;
  ws: WebSocket;
  initialContent: string;
  language: string;
  username: string;
}

export interface EditorInstance {
  editor: monaco.editor.IStandaloneCodeEditor;
  ydoc: Y.Doc;
  setLanguage: (lang: string) => void;
  getContent: () => string;
  applyUpdate: (base64Update: string) => void;
  getStateUpdate: () => string;
  destroy: () => void;
}

/* ================================
   BASE64 HELPERS
================================ */

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/* ================================
   DETERMINISTIC SEED UPDATE
================================ */

const SEED_CLIENT_ID = 0;

function createSeedUpdate(content: string): Uint8Array {
  const seedDoc = new Y.Doc();
  seedDoc.clientID = SEED_CLIENT_ID;
  const seedText = seedDoc.getText('monaco');
  if (content && content.length > 0) {
    seedText.insert(0, content);
  }
  const update = Y.encodeStateAsUpdate(seedDoc);
  seedDoc.destroy();
  console.log('[CodeEditor] Created deterministic seed update', update.byteLength, 'bytes');
  return update;
}

/* ================================
   INIT
================================ */

function init(options: EditorInitOptions): EditorInstance {
  const { container, roomId, ws, initialContent, language, username } = options;

  // ── Yjs Document ──
  const ydoc = new Y.Doc();
  const ytext = ydoc.getText('monaco');

  // Apply deterministic seed so every client starts from identical Yjs state.
  // This prevents state mismatches when multiple users create the doc independently.
  const seedUpdate = createSeedUpdate(initialContent);
  Y.applyUpdate(ydoc, seedUpdate, 'remote');
  console.log('[CodeEditor] Applied seed update. Doc length:', ytext.length);

  // ── Monaco Editor ──
  const editor = monaco.editor.create(container, {
    value: initialContent,
    language: language,
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    lineNumbers: 'on',
    roundedSelection: false,
    padding: { top: 16 },
  });

  // ── y-monaco Binding ──
  const binding = new MonacoBinding(ytext, editor.getModel()!, new Set([editor]));

  // ── Outgoing Updates ──
  ydoc.on('update', (update: Uint8Array, origin: any) => {
    if (origin === 'remote') return;
    if (ws.readyState !== WebSocket.OPEN) return;

    const base64 = uint8ToBase64(update);
    console.log(`[CodeEditor] Sending incremental update (${base64.length} b64 chars)`);

    ws.send(JSON.stringify({
      type: 'code-update',
      roomId,
      update: base64,
      user: username,
    }));
  });

  // ── Helpers ──
  function setLanguage(lang: string): void {
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, lang);
    }
  }

  function getContent(): string {
    return editor.getValue();
  }

  function applyUpdate(base64Update: string): void {
    try {
      const update = base64ToUint8(base64Update);
      console.log('[CodeEditor] Applying update', update.byteLength, 'bytes');
      Y.applyUpdate(ydoc, update, 'remote');
    } catch (err) {
      console.error('Failed to apply Yjs update:', err);
    }
  }

  function getStateUpdate(): string {
    const state = Y.encodeStateAsUpdate(ydoc);
    return uint8ToBase64(state);
  }

  function destroy(): void {
    binding.destroy();
    editor.dispose();
    ydoc.destroy();
  }

  return { editor, ydoc, setLanguage, getContent, applyUpdate, getStateUpdate, destroy };
}

(window as any).CodeEditor = { init };
