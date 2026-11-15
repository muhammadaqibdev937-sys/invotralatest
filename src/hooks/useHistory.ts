import { useCallback, useRef, useState } from 'react';

const MAX_HISTORY_STEPS = 50;

interface HistoryState<T> {
  past: T[];
  present: T | null;
  future: T[];
}

export function useHistory<T>(initialState: T | null) {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const lastCoalesceKeyRef = useRef<string>('');
  const lastCoalesceTimeRef = useRef<number>(0);

  const resetHistory = useCallback((nextInitial: T | null) => {
    lastCoalesceKeyRef.current = '';
    lastCoalesceTimeRef.current = 0;
    setHistory({
      past: [],
      present: nextInitial,
      future: [],
    });
  }, []);

  const breakCoalesce = useCallback(() => {
    lastCoalesceKeyRef.current = '';
    lastCoalesceTimeRef.current = 0;
  }, []);

  const commit = useCallback(
    (updater: (prev: T) => T, coalesceKey = '') => {
      const now = Date.now();
      const isCoalesced =
        Boolean(coalesceKey) &&
        lastCoalesceKeyRef.current === coalesceKey &&
        now - lastCoalesceTimeRef.current < 500;

      lastCoalesceKeyRef.current = coalesceKey;
      lastCoalesceTimeRef.current = now;

      setHistory((prev) => {
        if (prev.present === null) return prev;
        const next = updater(prev.present);
        if (next === prev.present) return prev;

        const nextPast = isCoalesced
          ? prev.past
          : [...prev.past, prev.present].slice(-MAX_HISTORY_STEPS);

        return {
          past: nextPast,
          present: next,
          future: [],
        };
      });
    },
    []
  );

  const undo = useCallback(() => {
    lastCoalesceKeyRef.current = '';
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      const nextFuture =
        prev.present !== null
          ? [prev.present, ...prev.future].slice(0, MAX_HISTORY_STEPS)
          : prev.future;
      return {
        past: prev.past.slice(0, -1),
        present: previous,
        future: nextFuture,
      };
    });
  }, []);

  const redo = useCallback(() => {
    lastCoalesceKeyRef.current = '';
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const nextPast =
        prev.present !== null
          ? [...prev.past, prev.present].slice(-MAX_HISTORY_STEPS)
          : prev.past;
      return {
        past: nextPast,
        present: next,
        future: prev.future.slice(1),
      };
    });
  }, []);

  return {
    state: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    commit,
    undo,
    redo,
    resetHistory,
    breakCoalesce,
  };
}
