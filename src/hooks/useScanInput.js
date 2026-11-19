import { useEffect, useRef } from 'react';

const SETTLE_MS = 150; // text written in one go with no Enter after it: this much quiet ends the scan

/**
 * Handheld scanners that write the scanned text into the focused input instead of sending key
 * presses (Zebra DataWedge keystroke output, Sunmi "direct fill") lose the scan when nothing
 * on the page has focus — only their Enter arrives. So while nothing else has focus, an
 * invisible input holds it; inputmode="none" keeps the on-screen keyboard closed.
 * `onScan(text)` gets the text on Enter / Tab, or after a short pause.
 *
 * Its key presses don't bubble on to react-barcode-reader, so a scanner that types key by
 * key into it is read here once rather than twice. A text box the volunteer taps into, a
 * button or a dialog always keeps focus — this only takes it back from the page itself.
 */
const useScanInput = (onScan, enabled = true) => {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    const input = document.createElement('input');
    input.setAttribute('inputmode', 'none');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-hidden', 'true');
    input.name = 'scanner-input';
    input.tabIndex = -1;
    Object.assign(input.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '1px',
      height: '1px',
      opacity: '0',
      border: '0',
      padding: '0',
    });
    document.body.appendChild(input);

    let settle = null;
    const flush = () => {
      clearTimeout(settle);
      const text = input.value.trim();
      input.value = '';
      if (text) onScanRef.current(text);
    };
    const onInput = () => {
      clearTimeout(settle);
      settle = setTimeout(flush, SETTLE_MS);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        flush();
      }
    };
    const onKeyPress = (e) => e.stopPropagation();
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('keypress', onKeyPress);

    const refocus = () => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) input.focus({ preventScroll: true });
    };
    const later = () => setTimeout(refocus, 0);
    document.addEventListener('focusout', later);
    document.addEventListener('pointerup', later);
    refocus();

    return () => {
      clearTimeout(settle);
      document.removeEventListener('focusout', later);
      document.removeEventListener('pointerup', later);
      input.remove();
    };
  }, [enabled]);
};

export default useScanInput;
