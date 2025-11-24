import type { ChangeEvent } from "react";

type AxisSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
};

export function AxisSearchInput({
  value,
  onChange,
  placeholder = " Pesquise por nome / SKU ...",
  id = "axis-search",
}: AxisSearchInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <input
      id={id}
      type="search"
      className="axis-search-core-input"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onChange(value.trim());
        }
      }}
    />
  );
}
