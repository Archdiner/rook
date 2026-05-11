"use client";

import { useState } from "react";
import { saveExperimentBriefAction } from "@/app/app/findings/[id]/experiment/actions";

type ChangeType = "copy" | "style" | "reorder" | "remove";

interface FormDefaults {
  experimentName: string;
  element: string;
  changeType: ChangeType;
  variantDescription: string;
  primaryMetric: string;
  hypothesis: string;
}

interface Props {
  findingId: string;
  defaults: FormDefaults;
}

const CHANGE_TYPE_OPTIONS: Array<{ value: ChangeType; label: string }> = [
  { value: "copy", label: "Change text copy" },
  { value: "style", label: "Swap visual style" },
  { value: "reorder", label: "Move element" },
  { value: "remove", label: "Remove element" },
];

const INPUT_CLASS =
  "w-full border border-black/[0.1] rounded-lg px-3 py-2 text-sm text-[#111] bg-white focus:outline-none focus:ring-1 focus:ring-black/[0.2] placeholder-[#9B9B9B]";

const SECTION_LABEL = "block text-[11px] font-bold uppercase tracking-[0.15em] text-[#6B6B6B] mb-2";

export default function ExperimentBuilderForm({ findingId, defaults }: Props) {
  const [experimentName, setExperimentName] = useState(defaults.experimentName);
  const [element, setElement] = useState(defaults.element);
  const [changeType, setChangeType] = useState<ChangeType>(defaults.changeType);
  const [variantDescription, setVariantDescription] = useState(defaults.variantDescription);
  const [primaryMetric, setPrimaryMetric] = useState(defaults.primaryMetric);
  const [hypothesis, setHypothesis] = useState(defaults.hypothesis);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveExperimentBriefAction({
        findingId,
        experimentName,
        element,
        changeType,
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

      {/* Element */}
      <div>
        <label className={SECTION_LABEL} htmlFor="element">
          Element to change
        </label>
        <input
          id="element"
          type="text"
          value={element}
          onChange={(e) => setElement(e.target.value)}
          placeholder='e.g. "Get started" button in hero'
          maxLength={500}
          required
          className={INPUT_CLASS}
        />
        <p className="text-[11px] text-[#9B9B9B] mt-1.5">
          Describe the element precisely enough for a developer to find it
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
      </div>

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
          What the variant looks like. Your developer or A/B platform will use this.
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
          Hypothesis <span className="normal-case font-normal tracking-normal">(optional)</span>
        </label>
        <textarea
          id="hypothesis"
          value={hypothesis}
          onChange={(e) => setHypothesis(e.target.value)}
          rows={3}
          placeholder="e.g. &quot;Reducing visual emphasis on 'Book a demo' will increase 'Start free trial' clicks by 15%&quot;"
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
