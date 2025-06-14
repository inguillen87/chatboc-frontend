import React, { useEffect, useState } from "react";
import GooglePlacesAutocomplete from "react-google-autocomplete";
import { Input } from "./input";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

interface AddressAutocompleteProps {
  onSelect: (address: string) => void;
  value?: any;
  onChange?: (option: any | null) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  /**
   * If provided, the selected address will be persisted in localStorage
   * using this key. The stored value will also be used as the initial value
   * when the component mounts.
   */
  persistKey?: string;
}

const Maps_API_KEY =
  import.meta.env.VITE_Maps_API_KEY || "AIzaSyDbEoPzFgN5zJsIeywiRE7jRI8xr5ioGNI";

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  onSelect,
  value,
  onChange,
  placeholder = "Ej: Av. San Martín 123, Mendoza",
  className = "",
  autoFocus = false,
  persistKey,
}) => {
  const [internalValue, setInternalValue] = useState<any>(value || null);

  // Load from storage on mount if persistKey provided
  useEffect(() => {
    if (persistKey && !value) {
      const stored = safeLocalStorage.getItem(persistKey);
      if (stored) {
        const opt = { label: stored, value: stored };
        setInternalValue(opt);
        if (onChange) onChange(opt);
        onSelect(stored);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKey]);

  // Sync when parent value changes
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);
  if (!Maps_API_KEY) {
    return (
      <Input
        placeholder="Ingrese dirección"
        className={className}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.currentTarget.value.trim()) {
            onSelect(e.currentTarget.value.trim());
          }
        }}
        onBlur={(e) => {
          const val = e.currentTarget.value.trim();
          if (val) onSelect(val);
        }}
      />
    );
  }

  return (
    <GooglePlacesAutocomplete
      apiKey={Maps_API_KEY}
      autocompletionRequest={{
        componentRestrictions: { country: "ar" },
        types: ["address"],
      }}
      selectProps={{
        value: internalValue,
        onChange: (option: any) => {
          setInternalValue(option);
          if (persistKey) {
            if (option && option.value) {
              safeLocalStorage.setItem(persistKey, option.value);
            } else {
              safeLocalStorage.removeItem(persistKey);
            }
          }
          if (onChange) onChange(option);
          if (option && option.value) {
            onSelect(option.value);
          }
        },
        onBlur: (e: any) => {
          const val = (e.target as HTMLInputElement).value;
          if (val) {
            const opt = { label: val, value: val };
            if (persistKey) safeLocalStorage.setItem(persistKey, val);
            setInternalValue(opt);
            if (onChange) onChange(opt);
            onSelect(val);
          }
        },
        placeholder,
        isClearable: true,
        autoFocus,
        className,
        styles: {
          control: (base: any) => ({
            ...base,
            backgroundColor: "var(--input)",
            color: "var(--foreground)",
            minHeight: "2.5rem",
            borderRadius: "0.75rem",
            borderColor: "var(--border)",
            fontSize: "0.95rem",
          }),
          menu: (base: any) => ({
            ...base,
            backgroundColor: "var(--card)",
            color: "var(--foreground)",
            zIndex: 999999,
          }),
          option: (base: any, state: any) => ({
            ...base,
            backgroundColor: state.isFocused
              ? "var(--accent)"
              : "var(--card)",
            color: "var(--foreground)",
            cursor: "pointer",
          }),
          singleValue: (base: any) => ({
            ...base,
            color: "var(--foreground)",
          }),
          input: (base: any) => ({
            ...base,
            color: "var(--foreground)",
          }),
          placeholder: (base: any) => ({
            ...base,
            color: "var(--muted-foreground)",
          }),
        },
        onKeyDown: (e: any) => {
          if (e.key === "Enter" && e.target.value) {
            const val = e.target.value;
            if (persistKey) safeLocalStorage.setItem(persistKey, val);
            onSelect(val);
          }
        },
      }}
    />
  );
};

export default AddressAutocomplete;
