"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { DoctorCard } from "@/components/doctors/doctor-card";
import { Button } from "@/components/ui/button";
import { Grid } from "@/components/ui/grid";
import type { Doctor } from "@/lib/db/types";

type DoctorDirectoryProps = {
  doctors: Doctor[];
  departments: { slug: string; name: string }[];
  languages: string[];
};

const ALL = "";

/** Searchable, filterable doctor list. Filters are mirrored in the URL (?department=&language=) so results can be shared. */
export function DoctorDirectory({ doctors, departments, languages }: DoctorDirectoryProps) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState(ALL);
  const [language, setLanguage] = useState(ALL);
  const ids = { query: useId(), department: useId(), language: useId() };

  // Pick up filters from links such as /doctors?department=cardiology.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialDepartment = params.get("department");
    const initialLanguage = params.get("language");
    if (initialDepartment && departments.some((d) => d.slug === initialDepartment)) setDepartment(initialDepartment);
    if (initialLanguage && languages.includes(initialLanguage)) setLanguage(initialLanguage);
  }, [departments, languages]);

  useEffect(() => {
    const url = new URL(window.location.href);
    for (const [key, value] of [["department", department], ["language", language]] as const) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, "", url);
  }, [department, language]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return doctors.filter((doctor) => {
      if (department && doctor.department !== department) return false;
      if (language && !doctor.languages.includes(language)) return false;
      if (!needle) return true;
      return [doctor.name, doctor.specialty, ...doctor.interests].some((text) => text.toLowerCase().includes(needle));
    });
  }, [doctors, query, department, language]);

  const filtered = Boolean(query || department || language);
  const reset = () => {
    setQuery("");
    setDepartment(ALL);
    setLanguage(ALL);
  };

  return (
    <div>
      <form
        role="search"
        aria-label="Find a doctor"
        onSubmit={(event) => event.preventDefault()}
        className="grid gap-4 rounded-card bg-surface p-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] md:p-5"
      >
        <label htmlFor={ids.query} className="grid gap-2 text-caption font-medium">
          Search
          <span className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted"
            />
            <input
              id={ids.query}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, specialty or condition"
              className="field bg-canvas pl-10"
            />
          </span>
        </label>
        <label htmlFor={ids.department} className="grid gap-2 text-caption font-medium">
          Department
          <select
            id={ids.department}
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            className="field bg-canvas"
          >
            <option value={ALL}>All departments</option>
            {departments.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={ids.language} className="grid gap-2 text-caption font-medium">
          Language
          <select
            id={ids.language}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="field bg-canvas"
          >
            <option value={ALL}>Any language</option>
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </form>

      <div className="mt-8 flex min-h-10 flex-wrap items-center justify-between gap-4">
        <p aria-live="polite" className="text-small text-ink-muted">
          {results.length === doctors.length
            ? `Showing all ${doctors.length} doctors`
            : `${results.length} of ${doctors.length} doctors match`}
        </p>
        {filtered && (
          <Button variant="outline" size="sm" withIcon={false} onClick={reset} className="gap-1.5">
            <X aria-hidden="true" className="size-3.5" />
            Clear filters
          </Button>
        )}
      </div>

      {results.length > 0 ? (
        <Grid cols={3} className="mt-6 grid-cols-2 gap-x-4 gap-y-12 md:gap-x-5 md:gap-y-14">
          {results.map((doctor) => (
            <DoctorCard key={doctor.slug} doctor={doctor} headingLevel="h2" />
          ))}
        </Grid>
      ) : (
        <div className="mt-6 rounded-card border border-dashed border-line-strong p-10 text-center">
          <p className="text-h4">No doctors match those filters</p>
          <p className="mt-2 text-small text-ink-muted">Try another language or department, or clear the filters.</p>
        </div>
      )}
    </div>
  );
}
