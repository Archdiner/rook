"use client";

import { useState, useRef, useEffect } from "react";
import { saveExperimentBriefAction } from "@/app/app/findings/[id]/experiment/actions";
import type { ChangeType, SelectorSuggestion } from "@/app/app/findings/[id]/experiment/page";

interface FormDefaults {
  experimentName: string;
  selector: string;
  changeType: ChangeType;
  newValue: string;
  variantDescription: string;
  primaryMetric: string;
  hypothesis: string;
}

interface Props {
  findingId: string;
  defaults: FormDefaults;
  suggestions: SelectorSuggestion[];
}

const CHANGE_TYPE_OPTIONS: Array<{ value: ChangeType; label: string; hint: string }> = [
  { value: "copy", label: "Change text copy", hint: "Replaces element text content" },
  { value: "style", label: "Swap CSS classes", hint: "Adds/removes class names" },
  { value: "hide", label: "Hide element", hint: "Sets display: none on element" },
];

const INPUT_CLASS =
  "w-full border border-black/[0.1] rounded-lg px-3 py-2 text-sm text-[#111] bg-white focus:outline-none focus:ring-1 focus:ring-black/[0.2] placeholder-[#9B9B9B]";

const SECTION_LABEL = "block text-[11px] font-bold uppercase tracking-[0.15em] text-[#6B6B6B] mb-2";

function SuggestionsDropdown({
  suggestions,
  onSelect,
  onClose,
}: {
  suggestions: SelectorSuggestion[];
  onSelect: (selector: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  if (suggestions.length === 0) {
    return (
      <div ref={ref} className="absolute top-full left-0 right-0 mt-1 bg-white border border-black/[0.1] rounded-xl shadow-lg z-20 p-3">
        <p className="text-xs text-[#9B9B9B]">No snapshot elements available — type a selector manually.</p>
      </div>
    );
  }

  return (
    <div ref={ref} className="absolute top-full left-0 right-0 mt-1 bg-white border border-black/[0.1] rounded-xl shadow-lg z-20 max-h-52 overflow-y-auto">
      {suggestions.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => { onSelect(s.selector); onClose(); }}
          className="w-full text-left px-3 py-2.5 hover:bg-black/[0.03] transition-colors border-b border-black/[0.04] last:border-0"
        >
          <div className="text-xs font-medium text-[#111] truncate">{s.label}</div>
          <div className="font-mono text-[10px] text-[#9B9B9B] truncate mt-0.5">{s.selector}</div>
        </button>
      ))}
    </div>
  );
}

export default function ExperimentBuilderForm({ findingId, defaults, suggestions }: Props) {
  const [experimentName, setExperimentName] = useState(defaults.experimentName);
  const [selector, setSelector] = useState(defaults.selector);
  const [changeType, setChangeType] = useState<ChangeType>(defaults.changeType);
  const [newValue, setNewValue] = useState(defaults.newValue);
  const [variantDescription, setVariantDescription] = useState(defaults.variantDescription);
  const [primaryMetric, setPrimaryMetric] = useState(defaults.primaryMetric);
  const [hypothesis, setHypothesis] = useState(defaults.hypothesis);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveExperimentBriefAction({
        findingId,
        experimentName,
        selector,
        changeType,
        newValue,
        variantDescription,
        primaryMetric,
        hypothesis,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Experiment name */}
      <div>
        <label className={SECTION_LABEL} htmlFor="experiment-name">
          Experiment name
        </label>
        <input
          id="experiment-name"
          type="text"
          value={experimentName}
          onChange={(e) => setExperimentName(e.target.value)}
          maxLength={200}
          required
          className={INPUT_CLASS}
        />
      </div>

      {/* CSS selector */}
      <div>
        <label className={SECTION_LABEL} htmlFor="selector">
          CSS selector
        </label>
        <div className="relative">
          <div className="flex gap-2">
            <input
              id="selector"
              type="text"
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder="e.g. .hero h1, button.btn-primary"
              className={`${INPUT_CLASS} font-mono`}
            />
            {suggestions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSuggestions((v) => !v)}
                className="shrink-0 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] border border-black/[0.1] rounded-lg text-[#6B6B6B] hover:text-[#111] hover:border-black/[0.2] transition-colors bg-white"
              >
                Suggest
              </button>
            )}
          </div>
          {showSuggestions && (
            <SuggestionsDropdown
              suggestions={suggestions}
              onSelect={setSelector}
              onClose={() => setShowSuggestions(false)}
            />
          )}
        </div>
        <p className="text-[11px] text-[#9B9B9B] mt-1.5">
          Targets the element the script modifies at runtime — no code changes needed
        </p>
      </div>

      {/* Change type */}
      <div>
        <span className={SECTION_LABEL}>Change type</span>
        <div className="flex flex-wrap gap-2">
          {CHANGE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              title={opt.hint}
              onClick={() => setChangeType(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                changeType === opt.value
                  ? "bg-[#111] text-[#FAFAF8]"
                  : "bg-black/[0.04] text-[#6B6B6B] hover:bg-black/[0.07]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[#9B9B9B] mt-1.5">
          {CHANGE_TYPE_OPTIONS.find((o) => o.value === changeType)?.hint}
        </p>
      </div>

      {/* New value — hidden for "hide" type */}
      {changeType !== "hide" && (
        <div>
          <label className={SECTION_LABEL} htmlFor="new-value">
            {changeType === "copy" ? "Variant copy" : "CSS classes to apply"}
          </label>
          <input
            id="new-value"
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={
              changeType === "copy"
                ? "e.g. Get started — free"
                : "e.g. bg-blue-600 text-white font-bold"
            }
            className={changeType === "style" ? `${INPUT_CLASS} font-mono` : INPUT_CLASS}
          />
          <p className="text-[11px] text-[#9B9B9B] mt-1.5">
            {changeType === "copy"
              ? "The replacement text the script writes into the element"
              : "Space-separated class names added to the element in the variant"}
          </p>
        </div>
      )}

      {/* Variant description */}
      <div>
        <label className={SECTION_LABEL} htmlFor="variant-description">
          Variant B description
        </label>
        <textarea
          id="variant-description"
          value={variantDescription}
          onChange={(e) => setVariantDescription(e.target.value)}
          rows={4}
          required
          className={`${INPUT_CLASS} resize-none`}
        />
        <p className="text-[11px] text-[#9B9B9B] mt-1.5">
          Human-readable description for your A/B testing platform
        </p>
      </div>

      {/* Primary metric */}
      <div>
        <label className={SECTION_LABEL} htmlFor="primary-metric">
          Primary metric
        </label>
        <input
          id="primary-metric"
          type="text"
          value={primaryMetric}
          onChange={(e) => setPrimaryMetric(e.target.value)}
          maxLength={200}
          required
          className={INPUT_CLASS}
        />
        <p className="text-[11px] text-[#9B9B9B] mt-1.5">
          What you&apos;ll measure to declare a winner
        </p>
      </div>

      {/* Hypothesis — optional */}
      <div>
        <label className={SECTION_LABEL} htmlFor="hypothesis">
          Hypothesis{" "}
          <span className="normal-case font-normal tracking-normal">(optional)</span>
        </label>
        <textarea
          id="hypothesis"
          value={hypothesis}
          onChange={(e) => setHypothesis(e.target.value)}
          rows={3}
          placeholder="e.g. Reducing emphasis on secondary CTA will increase primary CTA clicks by 15%"
          className={`${INPUT_CLASS} resize-none`}
        />
      </div>

      {/* Submit */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-[#111] text-[#FAFAF8] px-5 py-2.5 font-bold text-sm uppercase tracking-[0.08em] hover:opacity-80 disabled:opacity-40 transition-opacity"
        >
          {saving ? "Saving…" : "Save brief"}
        </button>
      </div>
    </form>
  );
}
