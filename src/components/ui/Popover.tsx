"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";

export interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
  position?: "top" | "bottom" | "left" | "right";
  offset?: number;
  children: React.ReactNode;
}

interface Position {
  top: number;
  left: number;
  arrowTop?: number;
  arrowLeft?: number;
  arrowDirection: "top" | "bottom" | "left" | "right";
}

export function Popover({
  isOpen,
  onClose,
  anchorRect,
  position = "bottom",
  offset = 8,
  children,
}: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [computedPosition, setComputedPosition] = useState<Position | null>(null);

  const calculatePosition = useCallback(() => {
    if (!anchorRect || !popoverRef.current) return null;

    const popoverRect = popoverRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;
    let arrowDirection: Position["arrowDirection"] = position;

    // Calculate initial position based on preferred position
    switch (position) {
      case "top":
        top = anchorRect.top - popoverRect.height - offset;
        left = anchorRect.left + (anchorRect.width - popoverRect.width) / 2;
        break;
      case "bottom":
        top = anchorRect.bottom + offset;
        left = anchorRect.left + (anchorRect.width - popoverRect.width) / 2;
        break;
      case "left":
        top = anchorRect.top + (anchorRect.height - popoverRect.height) / 2;
        left = anchorRect.left - popoverRect.width - offset;
        break;
      case "right":
        top = anchorRect.top + (anchorRect.height - popoverRect.height) / 2;
        left = anchorRect.right + offset;
        break;
    }

    // Auto-reposition if near viewport edge
    // Check horizontal bounds
    if (left < 8) {
      left = 8;
    } else if (left + popoverRect.width > viewportWidth - 8) {
      left = viewportWidth - popoverRect.width - 8;
    }

    // Check vertical bounds and flip if necessary
    if (position === "bottom" && top + popoverRect.height > viewportHeight - 8) {
      top = anchorRect.top - popoverRect.height - offset;
      arrowDirection = "top";
    } else if (position === "top" && top < 8) {
      top = anchorRect.bottom + offset;
      arrowDirection = "bottom";
    }

    // Calculate arrow position
    const arrowLeft = anchorRect.left + anchorRect.width / 2 - left;
    const arrowTop = anchorRect.top + anchorRect.height / 2 - top;

    return { top, left, arrowLeft, arrowTop, arrowDirection };
  }, [anchorRect, position, offset]);

  // Calculate position when open
  useEffect(() => {
    if (isOpen && anchorRect) {
      // Use requestAnimationFrame to ensure popover is rendered before calculating position
      const frame = requestAnimationFrame(() => {
        setComputedPosition(calculatePosition());
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [isOpen, anchorRect, calculatePosition]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay adding listener to avoid immediate close from the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const arrowStyle = computedPosition
    ? getArrowStyle(computedPosition)
    : undefined;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg p-2 animate-in fade-in zoom-in-95 duration-150"
      style={{
        top: computedPosition?.top ?? -9999,
        left: computedPosition?.left ?? -9999,
        visibility: computedPosition ? "visible" : "hidden",
      }}
    >
      {/* Arrow */}
      {computedPosition && (
        <div
          className="absolute w-2 h-2 bg-zinc-800 border-zinc-700 rotate-45"
          style={arrowStyle}
          aria-hidden="true"
        />
      )}
      {children}
    </div>
  );
}

function getArrowStyle(position: Position): React.CSSProperties {
  const { arrowDirection, arrowLeft, arrowTop } = position;

  switch (arrowDirection) {
    case "bottom":
      return {
        top: -4,
        left: Math.max(8, Math.min(arrowLeft! - 4, 200)),
        borderTop: "1px solid",
        borderLeft: "1px solid",
        borderColor: "inherit",
      };
    case "top":
      return {
        bottom: -4,
        left: Math.max(8, Math.min(arrowLeft! - 4, 200)),
        borderBottom: "1px solid",
        borderRight: "1px solid",
        borderColor: "inherit",
      };
    case "right":
      return {
        left: -4,
        top: Math.max(8, Math.min(arrowTop! - 4, 100)),
        borderTop: "1px solid",
        borderLeft: "1px solid",
        borderColor: "inherit",
      };
    case "left":
      return {
        right: -4,
        top: Math.max(8, Math.min(arrowTop! - 4, 100)),
        borderBottom: "1px solid",
        borderRight: "1px solid",
        borderColor: "inherit",
      };
  }
}

export default Popover;
