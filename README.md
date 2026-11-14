# MEANLOCK — Critical Meaning Preservation for AI-Transformed Information

MEANLOCK is a research prototype designed to answer a single question:

> **When an important message is translated, summarized, simplified, or rewritten, did the decision-critical information actually survive?**

Ordinary similarity checkers treat all words roughly the same. A rewritten notice can look 80% similar on the surface while losing a `5:00 PM` deadline, softening `"must"` into `"should"`, dropping a required `"income certificate"`, or flipping `"Do not submit"` into `"Submit"`.

**Core thesis:** *Similar text ≠ preserved meaning.*

---

## Target Users & Use Cases

Built initially for students and families navigating high-stakes school, scholarship, healthcare, financial, and public-safety notices that pass through translation, simplification, or AI summarization.

---

## Architecture (7-Stage Modular Pipeline)

Each stage lives in its own module under `src/engine/` so heuristics, weights, or extraction backends can be modified independently:

1. **Text Preprocessing** (`src/engine/preprocess.ts`) — Whitespace normalization, contraction expansion (`don't` → `do not`), sentence segmentation, and date/time normalization (`5 PM` ↔ `5:00 PM` ↔ `17:00`, `30 November` ↔ `November 30`).
2. **Critical Meaning Extraction** (`src/engine/extractor.ts`) — Extracts actionable units: `OBLIGATION`, `NEGATION`, `WARNING`, `DEADLINE`, `DATE`, `TIME`, `QUANTITY`, `MONEY`, `DOCUMENT`, `CONDITION`, `EXCEPTION`, `CONSEQUENCE`, `LOCATION`, `CONTACT`, `PERMISSION`, `ACTION`, and `WHO`.
3. **Comparison & Status Classification** (`src/engine/comparator.ts`) — Compares each extracted unit against the transformed text and assigns:
   - **PRESERVED**: Meaning, obligation strength, numbers, dates/times, and polarity survived.
   - **WEAKENED**: Mandatory requirement softened to advisory (`must` → `should`), `"only"` restriction dropped, or certainty reduced.
   - **LOST**: Critical fact, time, quantity, document, or consequence disappeared.
   - **CHANGED**: Number, date, time, location, consequence, or negation polarity materially altered.
4. **Weighted Score & Explanations** (`src/engine/scorer.ts`) — Computes the Critical Meaning Preservation Score using configurable **prototype weights** (`src/engine/config.ts`, explicitly labeled as prototype weights rather than scientifically validated) and generates plain-language *"What Changed?"* explanations.
5. **Surface Similarity Baseline** (`src/engine/baseline.ts`) — Computes TF-IDF unigram + bigram + char-3gram cosine similarity and Jaccard overlap to contrast surface text similarity against critical-unit preservation.
6. **Meaning Chain** (`src/engine/index.ts`) — Evaluates multi-stage pipelines (e.g., `Original → Back-Translation → Simplified → Short SMS Summary`) and identifies the exact stage with the largest meaning degradation.
7. **Experiment Mode** (`src/engine/index.ts`, `src/engine/demos.ts`) — Runs batch evaluations over labeled test cases, computes Precision, Recall, F1, False Positives, False Negatives, baseline blind spots, and exports CSV. Metrics are strictly computed from actual runs (displaying `"Not yet evaluated."` before execution).

### Optional Server-Side Gemini Semantic Assist

`server.ts` provides `/api/analyze` using `@google/genai` (`gemini-4-hydrogen`) when `GEMINI_API_KEY` is configured in the server environment. Extracted units are still scored by MEANLOCK's deterministic weighted formula (never LLM-invented scores). If `GEMINI_API_KEY` is unavailable, the system transparently falls back to the local deterministic NLP & rule engine.

---

## Running Locally

### Prerequisites
- Node.js 20+
- npm

### Install & Start
```bash
npm install
npm run dev
```
Open `http://localhost:3000`.

### Build & Typecheck
```bash
npm run lint
npm run build
```

---

## Example Input / Output

**Original:**
> Students must submit the scholarship application before 5:00 PM on 30 November. Late submissions will not be considered. Applicants must upload their income certificate.

**Transformed:**
> Students should submit the scholarship application by November 30. Late applications may not be accepted.

**MEANLOCK Output:**
- **Obligation (`must submit` → `should submit`)**: WEAKENED — Requirement became advisory.
- **Exact Time (`5:00 PM` → `—`)**: LOST — Exact deadline time disappeared.
- **Date (`30 November` → `November 30`)**: PRESERVED — Same calendar date preserved.
- **Consequence (`Late submissions will not be considered.` → `Late applications may not be accepted.`)**: CHANGED — Consequence became uncertain.
- **Required Document (`income certificate` → `—`)**: LOST — Required document disappeared.

---

## Known Limitations & Honest Failure Cases

- **Implicit Real-World Context:** Consequences that are implied culturally or pragmatically without explicit markers (e.g., losing a rate lock without stating a dollar penalty) may be missed.
- **Nested Double Negatives & Idioms:** Complex constructs like *"not accepted unless deposits are not unpaid"* can trigger conservative polarity warnings even when human simplification resolves them accurately.
- **Multilingual Scripts:** Only English rules are validated in this prototype. Architecture slots for `English → Hindi`, `English → Urdu`, and `English → Marathi` are marked **Planned** and are not claimed as evaluated.
