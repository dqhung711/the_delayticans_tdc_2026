import { useRef, useState } from "react";
import { useAccessibility } from "../context/AccessibilityContext";
import {
  COLORBLIND_TYPE_LABEL,
  COLORBLIND_TYPE_SHORT,
  type ColorblindType,
} from "../lib/colorPalettes";

const OPTIONS: ColorblindType[] = [
  "off",
  "deuteranopia",
  "protanopia",
  "tritanopia",
];

export function ColorblindToggle() {
  const { colorblindType, setColorblindType } = useAccessibility();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = colorblindType !== "off";
  const shortLabel =
    colorblindType === "off"
      ? "CB"
      : COLORBLIND_TYPE_SHORT[colorblindType];

  return (
    <div className="colorblind-menu" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`colorblind-toggle ${active ? "colorblind-toggle--active" : ""} colorblind-toggle--${colorblindType}`}
        aria-label={`Color vision: ${COLORBLIND_TYPE_LABEL[colorblindType]}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={COLORBLIND_TYPE_LABEL[colorblindType]}
      >
        <span className="colorblind-toggle__dots" aria-hidden="true">
          <i className="colorblind-toggle__dot colorblind-toggle__dot--blue" />
          <i className="colorblind-toggle__dot colorblind-toggle__dot--orange" />
          <i className="colorblind-toggle__dot colorblind-toggle__dot--green" />
        </span>
        <span className="colorblind-toggle__label">
          {active ? shortLabel : "Colorblind"}
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="colorblind-menu__backdrop"
            aria-label="Close color vision menu"
            onClick={() => setOpen(false)}
          />
          <ul className="colorblind-menu__list" role="listbox" aria-label="Color vision type">
            {OPTIONS.map((type) => (
              <li key={type} role="option" aria-selected={colorblindType === type}>
                <button
                  type="button"
                  className={`colorblind-menu__option ${
                    colorblindType === type ? "colorblind-menu__option--active" : ""
                  }`}
                  onClick={() => {
                    setColorblindType(type);
                    setOpen(false);
                  }}
                >
                  <span className="colorblind-menu__option-title">
                    {type === "off" ? "Standard" : COLORBLIND_TYPE_SHORT[type as Exclude<ColorblindType, "off">]}
                  </span>
                  <span className="colorblind-menu__option-desc">{COLORBLIND_TYPE_LABEL[type]}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
