import React, { useLayoutEffect, useRef } from 'react';

interface BaseProps {
  value: string;
  nodeKey: string;
  onLiveChange: (nextValue: string) => void;
  onCommitBoundary?: () => void;
  moveCaretToEndOnMount?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onCaretChange?: (selectionStart: number, selectionEnd: number) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  'aria-label'?: string;
  dir?: 'auto' | 'ltr' | 'rtl';
}

interface InputProps extends BaseProps {
  as: 'input';
  type?: string;
}

interface TextareaProps extends BaseProps {
  as: 'textarea';
  rows?: number;
}

export type LiveTextControlProps = InputProps | TextareaProps;

export const LiveTextControl: React.FC<LiveTextControlProps> = (props) => {
  const {
    as,
    value,
    nodeKey,
    onLiveChange,
    onCommitBoundary,
    moveCaretToEndOnMount = false,
    onKeyDown,
    onFocus,
    onBlur,
    onCaretChange,
    className,
    style,
    disabled,
    autoFocus,
    placeholder,
    dir = 'auto',
  } = props;
  const ariaLabel = props['aria-label'];

  const elRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const lastEmittedRef = useRef(value);
  const latestValueRef = useRef(value);
  latestValueRef.current = value;
  const lastNodeKeyRef = useRef(nodeKey);
  const didInitialCaretRef = useRef(false);

  // Sync external updates (undo/redo, layer switch, companion panel edit) without clobbering active typing/IME
  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;

    if (lastNodeKeyRef.current !== nodeKey) {
      lastNodeKeyRef.current = nodeKey;
      isComposingRef.current = false;
      lastEmittedRef.current = value;
      if (el.value !== value) {
        el.value = value;
      }
      return;
    }

    if (isComposingRef.current) return;

    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      if (el.value !== value) {
        const wasFocused = document.activeElement === el;
        const selStart = el.selectionStart;
        const selEnd = el.selectionEnd;
        el.value = value;
        if (wasFocused && selStart !== null && selEnd !== null) {
          const clampedStart = Math.min(selStart, value.length);
          const clampedEnd = Math.min(selEnd, value.length);
          try {
            el.setSelectionRange(clampedStart, clampedEnd);
          } catch {
            // Ignore selection range errors on unsupported input types
          }
        }
      }
    }
  }, [value, nodeKey]);

  // Only place caret at the end once on initial mount when requested (never on re-renders)
  useLayoutEffect(() => {
    if (!moveCaretToEndOnMount || didInitialCaretRef.current) return;
    const el = elRef.current;
    if (!el) return;
    didInitialCaretRef.current = true;
    const len = el.value.length;
    try {
      el.setSelectionRange(len, len);
    } catch {
      // Ignore
    }
  }, [moveCaretToEndOnMount]);

  const notifyCaret = (el: HTMLInputElement | HTMLTextAreaElement | null) => {
    if (!el || !onCaretChange) return;
    const len = el.value.length;
    onCaretChange(el.selectionStart ?? len, el.selectionEnd ?? len);
  };

  useLayoutEffect(() => {
    if (!onCaretChange || !elRef.current) return;
    const len = elRef.current.value.length;
    onCaretChange(elRef.current.selectionStart ?? len, elRef.current.selectionEnd ?? len);
  }, [value, nodeKey, onCaretChange]);

  const emitIfChanged = (nextVal: string) => {
    if (nextVal === lastEmittedRef.current) return;
    lastEmittedRef.current = nextVal;
    if (nextVal === latestValueRef.current) return;
    onLiveChange(nextVal);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const native = e.nativeEvent as InputEvent | undefined;
    if (isComposingRef.current || native?.isComposing) {
      return;
    }
    emitIfChanged(e.currentTarget.value);
    notifyCaret(e.currentTarget);
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (
    e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    isComposingRef.current = false;
    emitIfChanged(e.currentTarget.value);
    notifyCaret(e.currentTarget);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Flush any uncommitted IME composition on blur so nothing typed is ever lost
    isComposingRef.current = false;
    emitIfChanged(e.currentTarget.value);
    onCommitBoundary?.();
    onBlur?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      isComposingRef.current = false;
      emitIfChanged(e.currentTarget.value);
      onCommitBoundary?.();
    }
    onKeyDown?.(e);
  };

  const sharedProps = {
    ref: elRef,
    defaultValue: value,
    disabled,
    autoFocus,
    placeholder,
    dir,
    'aria-label': ariaLabel,
    className,
    style,
    onChange: handleChange,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      notifyCaret(e.currentTarget);
      onFocus?.(e);
    },
    onClick: (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      notifyCaret(e.currentTarget);
    },
    onSelect: (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      notifyCaret(e.currentTarget);
    },
    onKeyUp: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      notifyCaret(e.currentTarget);
    },
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
  };

  if (as === 'input') {
    return <input {...sharedProps} type={props.type ?? 'text'} />;
  }

  return <textarea {...sharedProps} rows={props.rows} />;
};
