import { useEffect, useRef, useState } from "react";
import "./search-bar-with-filter.css";
import { AxisSearchInput } from "../components/elements/AxisSearchInput";

type CategoryFilter = {
  id: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  filters: CategoryFilter[];
  selectedIds: string[];
  onToggleFilter: (id: string) => void;
};

export function SearchBarWithCategoryFilter({
  value,
  onChange,
  filters,
  selectedIds,
  onToggleFilter,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="axis-search-wrapper" ref={wrapperRef}>
      <div className="axis-search-bar">
        <AxisSearchInput
          value={value}
          onChange={onChange}
          placeholder=" Pesquise por nome / SKU ..."
        />

        <button
          type="button"
          className="axis-search-filter-button"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {open && (
        <div className="axis-filter-popover">
          <div className="axis-filter-header">Filtrar categorias</div>
          <div className="axis-filter-options">
            {filters.length === 0 && (
              <div className="axis-filter-empty">
                Nenhuma categoria cadastrada
              </div>
            )}

            {filters.map((filter) => {
              const checked = selectedIds.includes(filter.id);
              return (
                <label
                  key={filter.id}
                  className={
                    "axis-filter-option" +
                    (checked ? " axis-filter-option--active" : "")
                  }
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleFilter(filter.id)}
                  />
                  <span>{filter.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
