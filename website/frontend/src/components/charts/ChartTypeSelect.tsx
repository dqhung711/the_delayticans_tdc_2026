export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
}

export function ChartTypeSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel = "Chart type",
}: Props<T>) {
  return (
    <div className="chart-type-tabs" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`chart-type-tab ${value === opt.value ? "chart-type-tab--active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
