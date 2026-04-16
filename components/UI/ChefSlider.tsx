import React, { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface ChefSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

const getPrecision = (step: number) => {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
};

export const ChefSlider: React.FC<ChefSliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onChange,
  onChangeEnd,
  ariaLabel,
  disabled = false,
  className,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingValueRef = useRef<number | null>(null);
  const safeValueRef = useRef(0);
  const getValueFromClientXRef = useRef<(clientX: number) => number>(() => 0);
  const updateFromClientXRef = useRef<(clientX: number) => number>(() => 0);
  const finishDragRef = useRef<(finalValue?: number) => void>(() => undefined);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);

  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : safeMin + 1;
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const precision = useMemo(() => Math.min(4, Math.max(getPrecision(safeStep) + 1, 2)), [safeStep]);

  const normalize = (raw: number) => {
    const clamped = clamp(raw, safeMin, safeMax);
    return Number(clamped.toFixed(precision));
  };

  const safeValue = normalize(Number.isFinite(value) ? value : safeMin);
  safeValueRef.current = safeValue;
  const visualValue = dragValue ?? safeValue;
  const percent = ((visualValue - safeMin) / (safeMax - safeMin)) * 100;

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  const flushPendingChange = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (pendingValueRef.current === null) return null;
    const next = pendingValueRef.current;
    pendingValueRef.current = null;
    onChange(next);
    return next;
  };

  const scheduleChange = (next: number) => {
    pendingValueRef.current = next;
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const pending = pendingValueRef.current;
      pendingValueRef.current = null;
      if (pending !== null) {
        onChange(pending);
      }
    });
  };

  const getValueFromClientX = (clientX: number) => {
    const root = rootRef.current;
    if (!root) return safeValue;
    const rect = root.getBoundingClientRect();
    if (rect.width <= 0) return safeValue;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return normalize(safeMin + ratio * (safeMax - safeMin));
  };
  getValueFromClientXRef.current = getValueFromClientX;

  const updateFromClientX = (clientX: number) => {
    const next = getValueFromClientX(clientX);
    flushSync(() => setDragValue(next));
    scheduleChange(next);
    return next;
  };
  updateFromClientXRef.current = updateFromClientX;

  const finishDrag = (finalValue?: number) => {
    if (pointerIdRef.current === null) return;
    const next = normalize(finalValue ?? dragValue ?? safeValueRef.current);
    pointerIdRef.current = null;
    setDragValue(null);
    setIsDragging(false);
    const flushed = flushPendingChange();
    if (flushed !== next) {
      onChange(next);
    }
    if (onChangeEnd) {
      onChangeEnd(next);
    }
  };
  finishDragRef.current = finishDrag;

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerIdRef.current) return;
      updateFromClientXRef.current(event.clientX);
    };

    const handleStop = (event: PointerEvent) => {
      if (event.pointerId !== pointerIdRef.current) return;
      finishDragRef.current(getValueFromClientXRef.current(event.clientX));
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', handleStop, { passive: true });
    window.addEventListener('pointercancel', handleStop, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleStop);
      window.removeEventListener('pointercancel', handleStop);
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    setIsDragging(true);
    pointerIdRef.current = event.pointerId;
    updateFromClientX(event.clientX);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    let next: number | null = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      next = safeValue - safeStep;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      next = safeValue + safeStep;
    } else if (event.key === 'PageDown') {
      next = safeValue - safeStep * 10;
    } else if (event.key === 'PageUp') {
      next = safeValue + safeStep * 10;
    } else if (event.key === 'Home') {
      next = safeMin;
    } else if (event.key === 'End') {
      next = safeMax;
    }

    if (next === null) return;

    event.preventDefault();
    const normalized = normalize(next);
    onChange(normalized);
    if (onChangeEnd) {
      onChangeEnd(normalized);
    }
  };

  return (
    <div
      ref={rootRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuemin={safeMin}
      aria-valuemax={safeMax}
      aria-valuenow={Math.round(visualValue * 100) / 100}
      aria-disabled={disabled}
      className={`chef-slider ${disabled ? 'is-disabled' : ''} ${isDragging ? 'is-dragging' : ''} ${className ?? ''}`.trim()}
      style={{ '--chef-slider-pct': `${percent}%` } as React.CSSProperties}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    >
      <div className="chef-slider__track" />
      <div className="chef-slider__fill" />
      <div className="chef-slider__thumb" />
    </div>
  );
};
