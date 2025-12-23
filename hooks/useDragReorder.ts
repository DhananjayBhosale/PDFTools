import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface DragItem {
  id: string;
}

interface Slot {
  id: string; // The ID of the item currently in this slot (at start of drag)
  top: number;
  bottom: number;
  left: number;
  right: number;
  centerX: number;
  centerY: number;
}

interface UseDragReorderOptions<T> {
  items: T[];
  onReorder: (newItems: T[]) => void;
  containerRef: React.RefObject<HTMLElement>;
  keyExtractor: (item: T) => string;
}

export function useDragReorder<T>({ items, onReorder, containerRef, keyExtractor }: UseDragReorderOptions<T>) {
  // State
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overlayStyle, setOverlayStyle] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Refs
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const slotsRef = useRef<Slot[]>([]);
  const scrollIntervalRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number, y: number } | null>(null);
  const isDraggingRef = useRef(false);

  // Helper to register refs
  const registerItem = useCallback((id: string, node: HTMLElement | null) => {
    if (node) itemRefs.current.set(id, node);
    else itemRefs.current.delete(id);
  }, []);

  // --- CORE LOGIC ---

  const calculateTargetIndex = (docX: number, docY: number): number => {
    const slots = slotsRef.current;
    if (slots.length === 0) return 0;

    // Find the slot closest to the cursor
    // For grids, we check row then column
    // For lists, it effectively works same way (one item per row or one row of items)
    
    // Simple distance heuristic usually fails for variable sized grids. 
    // We use the "Row/Col" logic from the previous ReorderPDF implementation.
    
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const isVerticalList = s.bottom - s.top > s.right - s.left; // Rough guess if list item
      
      // Check if we are "before" this slot visually
      // In a grid (LTR, TTB):
      // If cursor Y is significantly above slot top
      if (docY < s.top) return i;
      
      // If cursor is within the vertical band of this row
      if (docY >= s.top && docY <= s.bottom) {
        // Check Horizontal
        if (docX < s.centerX) return i;
      }
    }
    
    return slots.length;
  };

  const performReorder = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingRef.current || !activeId) return;

    const docX = clientX + window.scrollX;
    const docY = clientY + window.scrollY;

    const fromIndex = items.findIndex(item => keyExtractor(item) === activeId);
    if (fromIndex === -1) return;

    const targetIndex = calculateTargetIndex(docX, docY);

    if (targetIndex !== fromIndex && targetIndex <= items.length) {
      const newItems = [...items];
      const [moved] = newItems.splice(fromIndex, 1);
      newItems.splice(targetIndex, 0, moved);
      onReorder(newItems);
    }
  }, [items, activeId, onReorder, keyExtractor]);

  const handlePointerDown = useCallback((e: React.PointerEvent | React.MouseEvent, id: string) => {
    // Only left click
    if ('button' in e && e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();

    const el = itemRefs.current.get(id);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    
    // Capture Drag Start
    isDraggingRef.current = true;
    setActiveId(id);
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setOverlayStyle({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    });
    pointerRef.current = { x: e.clientX, y: e.clientY };

    // Freeze Slots
    // We calculate slots based on the CURRENT layout order
    const slots: Slot[] = [];
    items.forEach(item => {
      const itemId = keyExtractor(item);
      if (itemId === id) return; // Don't make a slot for the dragged item itself
      
      const node = itemRefs.current.get(itemId);
      if (node) {
        const r = node.getBoundingClientRect();
        slots.push({
          id: itemId,
          top: r.top + window.scrollY,
          bottom: r.bottom + window.scrollY,
          left: r.left + window.scrollX,
          right: r.right + window.scrollX,
          centerX: r.left + r.width / 2 + window.scrollX,
          centerY: r.top + r.height / 2 + window.scrollY
        });
      }
    });
    
    // Sort slots visually to ensure linear index mapping matches visual flow
    slots.sort((a, b) => {
      // Row priority with tolerance
      if (Math.abs(a.top - b.top) > 10) return a.top - b.top;
      return a.left - b.left;
    });
    
    slotsRef.current = slots;

    // Attach Listeners
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    
    startAutoScroll();
  }, [items, keyExtractor]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current) return;
    pointerRef.current = { x: e.clientX, y: e.clientY };
    
    // Update Overlay
    // We don't setState activeId or offset here to avoid re-renders,
    // but we do update overlayStyle if we want it controlled by React state.
    // For perf, we could use a ref for the overlay DOM, but React state is fine for <60fps updates usually.
    // We'll update state to move the overlay.
    // Actually, let's optimize: performReorder depends on state.
    
    performReorder(e.clientX, e.clientY);
  }, [performReorder]);

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
    stopAutoScroll();
    setActiveId(null);
    slotsRef.current = [];
    
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  }, []);

  // --- AUTO SCROLL ---

  const startAutoScroll = () => {
    if (scrollIntervalRef.current) return;

    const scrollLoop = () => {
      if (!pointerRef.current || !isDraggingRef.current) return;
      
      const { x, y } = pointerRef.current;
      const h = window.innerHeight;
      const zone = 100;
      
      let speed = 0;
      if (y < zone) speed = -(zone - y) * 0.3;
      else if (y > h - zone) speed = (y - (h - zone)) * 0.3;

      if (speed !== 0) {
        window.scrollBy(0, speed);
        performReorder(x, y);
      }
      
      scrollIntervalRef.current = requestAnimationFrame(scrollLoop);
    };
    
    scrollIntervalRef.current = requestAnimationFrame(scrollLoop);
  };

  const stopAutoScroll = () => {
    if (scrollIntervalRef.current) cancelAnimationFrame(scrollIntervalRef.current);
    scrollIntervalRef.current = null;
  };

  return {
    activeId,
    dragHandlers: { onPointerDown: handlePointerDown },
    registerItem,
    overlayStyle: {
      ...overlayStyle,
      top: (pointerRef.current?.y ?? 0) - dragOffset.y,
      left: (pointerRef.current?.x ?? 0) - dragOffset.x,
    }
  };
}