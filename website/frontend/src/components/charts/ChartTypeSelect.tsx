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
    <label className="chart-select">
      <span className="chart-select__label">View</span>
      <select
        className="chart-select__input"
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
