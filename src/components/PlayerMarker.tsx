import { useRef, useState } from "react";
import type { NormalizedBox } from "../lib/analysis/frameExtraction";

export default function PlayerMarker({
  frameSrc,
  onConfirm,
}: {
  frameSrc: string;
  onConfirm: (box: NormalizedBox) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState<NormalizedBox | null>(null);

  function toFraction(clientX: number, clientY: number): { x: number; y: number } {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1),
    };
  }

  function handleMouseDown(e: React.MouseEvent) {
    setDragStart(toFraction(e.clientX, e.clientY));
    setBox(null);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragStart) return;
    const current = toFraction(e.clientX, e.clientY);
    setBox({
      x: Math.min(dragStart.x, current.x),
      y: Math.min(dragStart.y, current.y),
      width: Math.abs(current.x - dragStart.x),
      height: Math.abs(current.y - dragStart.y),
    });
  }

  function handleMouseUp() {
    setDragStart(null);
  }

  return (
    <div>
      <p>Drag a box around yourself in this frame so the analysis knows which player to track.</p>
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ position: "relative", display: "inline-block", cursor: "crosshair", userSelect: "none" }}
      >
        <img src={frameSrc} alt="Reference frame" style={{ display: "block", maxWidth: "100%" }} draggable={false} />
        {box && (
          <div
            style={{
              position: "absolute",
              left: `${box.x * 100}%`,
              top: `${box.y * 100}%`,
              width: `${box.width * 100}%`,
              height: `${box.height * 100}%`,
              border: "2px solid #ff0000",
              boxSizing: "border-box",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      <div>
        <button
          onClick={() => box && box.width > 0.02 && box.height > 0.02 && onConfirm(box)}
          disabled={!box || box.width <= 0.02 || box.height <= 0.02}
        >
          Confirm mark
        </button>
      </div>
    </div>
  );
}
