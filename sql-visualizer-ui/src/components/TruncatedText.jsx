import {
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { theme } from '../theme';

const SHOW_DELAY_MS = 200;
const HIDE_DELAY_MS = 80;
const TOOLTIP_GAP = 6;
const MAX_TOOLTIP_WIDTH = 360;

function TooltipContent({
  anchorRef,
  text,
  subtitle,
  subtitleColor,
  visible,
  onRequestHide,
  onCancelHide,
}) {
  const tooltipRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [positioned, setPositioned] = useState(false);
  const [copied, setCopied] = useState(false);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) return;

    const rect = anchor.getBoundingClientRect();
    const { offsetWidth: tooltipWidth, offsetHeight: tooltipHeight } = tooltip;

    let top = rect.bottom + TOOLTIP_GAP;
    if (top + tooltipHeight > window.innerHeight - 8) {
      top = rect.top - tooltipHeight - TOOLTIP_GAP;
    }

    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));

    setPosition({ top, left });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!visible) {
      setPositioned(false);
      return;
    }
    updatePosition();
    setPositioned(true);
  }, [visible, text, subtitle, updatePosition]);

  useEffect(() => {
    if (!visible) return;
    const hide = () => onRequestHide();
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [visible, onRequestHide]);

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked in locked-down environments */
    }
  };

  if (!visible) return null;

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      onMouseEnter={onCancelHide}
      onMouseLeave={onRequestHide}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 10000,
        maxWidth: MAX_TOOLTIP_WIDTH,
        padding: '10px 12px',
        background: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        fontFamily: '"Inter", sans-serif',
        pointerEvents: 'auto',
        opacity: positioned ? 1 : 0,
        transition: reducedMotion ? 'none' : 'opacity 0.12s ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: theme.textMain,
              lineHeight: 1.35,
              wordBreak: 'break-word',
            }}
          >
            {text}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: subtitleColor || theme.textMuted,
                marginTop: '4px',
                letterSpacing: '0.02em',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={`Copy ${text}`}
          style={{
            flexShrink: 0,
            border: `1px solid ${theme.border}`,
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '10px',
            fontWeight: 600,
            color: theme.textMuted,
            background: theme.headerBg,
            cursor: 'pointer',
            lineHeight: 1.2,
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>,
    document.body
  );
}

/**
 * Single-line ellipsis label with enterprise portal tooltip (truncated only).
 */
export default function TruncatedText({
  text,
  style,
  subtitle,
  subtitleColor,
}) {
  const ref = useRef(null);
  const showTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const [truncated, setTruncated] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !text) {
      setTruncated(false);
      return;
    }
    setTruncated(el.scrollWidth > el.clientWidth);
  }, [text]);

  const clearTimers = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const requestHide = useCallback(() => {
    clearTimers();
    hideTimerRef.current = setTimeout(() => setTooltipVisible(false), HIDE_DELAY_MS);
  }, [clearTimers]);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!truncated) return;
    cancelHide();
    clearTimers();
    showTimerRef.current = setTimeout(() => setTooltipVisible(true), SHOW_DELAY_MS);
  }, [truncated, cancelHide, clearTimers]);

  const handleMouseLeave = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    requestHide();
  }, [requestHide]);

  useEffect(() => {
    if (!truncated) setTooltipVisible(false);
  }, [truncated]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <>
      <span
        ref={ref}
        aria-label={truncated ? text : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
          ...style,
        }}
      >
        {text}
      </span>
      {truncated && (
        <TooltipContent
          anchorRef={ref}
          text={text}
          subtitle={subtitle}
          subtitleColor={subtitleColor}
          visible={tooltipVisible}
          onRequestHide={requestHide}
          onCancelHide={cancelHide}
        />
      )}
    </>
  );
}
