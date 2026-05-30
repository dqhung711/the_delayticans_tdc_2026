import React from "react";

interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

interface Props {
  items: LegendItem[];
}

export function CustomChartLegend({ items }: Props) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 mt-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <div 
            className="w-3 h-0.5 rounded-full" 
            style={{ 
              backgroundColor: item.color,
              borderTop: item.dashed ? `2px dashed ${item.color}` : 'none',
              height: item.dashed ? 0 : 2
            }} 
          />
          <span className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
