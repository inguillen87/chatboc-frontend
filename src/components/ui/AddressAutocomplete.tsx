import React, { useEffect, useRef, useState } from "react";
import { Input } from "./input";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

interface AddressAutocompleteProps {
  onSelect: (address: string) => void;
  value?: { label: string; value: string } | null;
  onChange?: (option: { label: string; value: string } | null) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  persistKey?: string;
  readOnly?: boolean;
  disabled?: boolean;
}

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || "";
// Optional comma-separated list of country codes to restrict geocoding results
const GEOCODER_COUNTRIES = import.meta.env.VITE_GEOCODER_COUNTRIES || "";

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  onSelect,
  value,
  onChange,
  placeholder = "Ej: Av. Principal 123",
  className = "",
  autoFocus = false,
  persistKey,
  readOnly = false,
  disabled = false,
}) => {
  const [query, setQuery] = useState(value?.label || "");
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const committedRef = useRef(false);

  const commit = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    const obj = { label: trimmed, value: trimmed };
    setQuery(trimmed);
    if (persistKey) safeLocalStorage.setItem(persistKey, trimmed);
    onChange?.(obj);
    onSelect(trimmed);
    committedRef.current = true;
  };

  // Load from storage on mount if persistKey provided
  useEffect(() => {
    if (persistKey && !value) {
      const stored = safeLocalStorage.getItem(persistKey);
      if (stored) {
        const opt = { label: stored, value: stored };
        setQuery(stored);
        onChange?.(opt);
        onSelect(stored);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKey]);

  // Sync when parent value changes
  useEffect(() => {
    if (value) {
      setQuery(value.label || value.value);
    } else {
      setQuery("");
    }
  }, [value]);

  // Fetch suggestions from MapTiler
  useEffect(() => {
    if (!MAPTILER_KEY || query.trim().length < 3) {
      setOptions([]);
      return;
    }
    const controller = new AbortController();
    const countryParam = GEOCODER_COUNTRIES
      ? `&country=${encodeURIComponent(GEOCODER_COUNTRIES)}`
      : "";
    fetch(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(
        query
      )}.json?key=${MAPTILER_KEY}&language=es&limit=5${countryParam}`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((data) => {
        const feats = Array.isArray(data?.features) ? data.features : [];
        const opts = feats
          .map(
            (f: any) =>
              f.place_name ||
              f.text ||
              f.properties?.name ||
              f.properties?.address ||
              f.properties?.formatted
          )
          .filter(Boolean);
        setOptions(opts);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [query]);

  if (readOnly || disabled) {
    return (
      <Input
        value={query}
        readOnly
        disabled={disabled}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => {
          const val = e.target.value;
          setQuery(val);
          onChange?.(val ? { label: val, value: val } : null);
        }}
        placeholder={placeholder}
        className={className}
        autoFocus={autoFocus}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit(query);
            setOpen(false);
          }
        }}
        onBlur={() => {
          if (!committedRef.current) {
            commit(query);
          }
          committedRef.current = false;
          setTimeout(() => setOpen(false), 100);
        }}
      />
      {open && options.length > 0 && (
        <ul className="absolute z-10 w-full bg-card border border-border rounded-md mt-1 max-h-60 overflow-auto">
          {options.map((opt) => (
            <li
              key={opt}
              className="px-3 py-2 cursor-pointer hover:bg-accent"
              onMouseDown={() => {
                commit(opt);
                setOpen(false);
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AddressAutocomplete;
