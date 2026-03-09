"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { searchAddresses, type AddressSuggestion } from "@/lib/address-search";
import { cn } from "@/lib/utils";

type AddressAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: AddressSuggestion) => void;
  error?: string;
  required?: boolean;
  showRequired?: boolean;
  placeholder?: string;
  label?: string;
  id?: string;
  className?: string;
};

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  error,
  required,
  showRequired,
  placeholder = "Numéro et nom de rue",
  label = "Adresse",
  id = "address",
  className,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const justSelectedRef = useRef(false);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsLoading(true);
    try {
      const results = await searchAddresses(query, 6);
      if (!abortRef.current?.signal.aborted) {
        setSuggestions(results);
        setIsOpen(results.length > 0);
      }
    } catch {
      if (!abortRef.current?.signal.aborted) {
        setSuggestions([]);
        setIsOpen(false);
      }
    } finally {
      if (!abortRef.current?.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    if (value.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => void fetchSuggestions(value), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchSuggestions]);

  const handleSelect = (suggestion: AddressSuggestion) => {
    justSelectedRef.current = true;
    onChange(suggestion.address);
    onSelect?.(suggestion);
    setSuggestions([]);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const dropdownContent =
    isOpen && suggestions.length > 0 ? (
      <ul
        id="address-autocomplete-listbox"
        role="listbox"
        className="absolute top-full left-0 right-0 z-[9999] mt-1 py-1 bg-white border border-neutral-200 rounded-lg shadow-xl max-h-60 overflow-auto"
      >
        {suggestions.map((s, i) => (
          <li
            key={`${s.label}-${i}`}
            role="option"
            tabIndex={0}
            className="px-4 py-2.5 text-sm cursor-pointer hover:bg-primary-50 focus:bg-primary-50 focus:outline-none transition-colors text-neutral-900"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSelect(s);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSelect(s);
            }}
          >
            {s.label}
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <div ref={containerRef} className={cn("w-full relative", className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-neutral-800 mb-1.5">
          {label}
          {showRequired && <span className="text-red-500"> *</span>}
        </label>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={isOpen ? "true" : "false"}
        aria-controls={isOpen ? "address-autocomplete-listbox" : undefined}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        className={cn(
          "w-full px-4 py-2 border rounded-lg bg-white",
          "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
          "disabled:bg-neutral-100 disabled:cursor-not-allowed",
          error && "border-red-500 focus:ring-red-500",
          !error && "border-neutral-300"
        )}
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <span className="inline-block w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {dropdownContent}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
