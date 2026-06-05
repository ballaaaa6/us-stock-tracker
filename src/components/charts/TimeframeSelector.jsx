import React from "react";

const RANGES = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"];

export default function TimeframeSelector({ range, onRangeChange }) {
  return (
    <div className="chart-range-tabs">
      {RANGES.map((r) => (
        <button key={r} className={`chart-range-tab${range === r ? " active" : ""}`} onClick={() => onRangeChange(r)}>
          {r}
        </button>
      ))}
    </div>
  );
}
