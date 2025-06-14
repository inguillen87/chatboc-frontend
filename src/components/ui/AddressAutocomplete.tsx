import React from "react";
import GooglePlacesAutocomplete from "react-google-autocomplete";
import { Input } from "./input";

interface AddressAutocompleteProps {
  onSelect: (address: string) => void;
  value?: any;
  onChange?: (option: any | null) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

const Maps_API_KEY = import.meta.env.VITE_Maps_API_KEY;

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  onSelect,
  value,
  onChange,
  placeholder = "Ej: Av. San Martín 123, Mendoza",
  className = "",
  autoFocus = false,
}) => {
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
        value,
        onChange: (option: any) => {
          if (onChange) onChange(option);
          if (option && option.value) {
            onSelect(option.value);
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
          singleValue: (base: any) => ({
            ...base,
            color: "var(--foreground)",
          }),
          input: (base: any) => ({
            ...base,
            color: "var(--foreground)",
          }),
        },
        onKeyDown: (e: any) => {
          if (e.key === "Enter" && e.target.value) {
            onSelect(e.target.value);
          }
        },
      }}
    />
  );
};

export default AddressAutocomplete;
