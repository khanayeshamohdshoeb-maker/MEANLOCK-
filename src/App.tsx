import { useEffect, useState } from 'react';
import { BookOpen, FlaskConical, GitCommitHorizontal, ScanSearch } from 'lucide-react';
import { AboutView } from './components/AboutView';
import { AnalyzeView } from './components/AnalyzeView';
import { ExperimentsView } from './components/ExperimentsView';
import { MeaningChainView } from './components/MeaningChainView';
import { computeBaselineSimilarity } from './engine/baseline';
import { compareUnitsAgainstTransformed } from './engine/comparator';
import { DEFAULT_PROTOTYPE_WEIGHTS } from './engine/config';
import { DEMO_SCENARIOS } from './engine/demos';
import { extractCriticalUnits } from './engine/extractor';
import { analyzeWithDeterministicEngine } from './engine/index';
import { preprocessText } from './engine/preprocess';
import { calculateScoreAndExplanations } from './engine/scorer';
import {
  AnalysisEngineMode,
  AnalysisResult,
  CriticalUnitType,
  ImportanceWeightConfig,
  LanguageCode,
  TransformationType,
} from './engine/types';

type NavTab = 'analyze' | 'chain' | 'experiments' | 'about';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function App() {
  const initialDemo = DEMO_SCENARIOS[0];

  const [activeTab, setActiveTab] = useState<NavTab>('analyze');
  const [analyzeViewMode, setAnalyzeViewMode] = useState<'workspace' | 'results'>('workspace');

  const [originalText, setOriginalText] = useState<string>(initialDemo.originalText);
  const [transformedText, setTransformedText] = useState<string>(initialDemo.transformedText);
  const [transformationType, setTransformationType] = useState<TransformationType>(
    initialDemo.transformationType
  );
  const [sourceLanguage] = useState<LanguageCode>('en');
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>('en');
  const [engineMode, setEngineMode] = useState<AnalysisEngineMode>('deterministic');
  const [geminiAvailable, setGeminiAvailable] = useState<boolean>(false);
  const [engineReady, setEngineReady] = useState<boolean>(true);

  const [weights, setWeights] = useState<ImportanceWeightConfig>(() => ({
    ...DEFAULT_PROTOTYPE_WEIGHTS,
    byType: { ...DEFAULT_PROTOTYPE_WEIGHTS.byType },
  }));

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStepIndex, setAnalysisStepIndex] = useState<number>(0);
  const [analysisStepDetail, setAnalysisStepDetail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { status?: string; geminiConfigured?: boolean } | null) => {
        if (active && data) {
          setEngineReady(data.status === 'ok');
          if (typeof data.geminiConfigured === 'boolean') {
            setGeminiAvailable(data.geminiConfigured);
          }
        }
      })
      .catch(() => {
        if (active) setEngineReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Executes the genuine 6-stage MEANLOCK pipeline step-by-step so each
   * UI processing indicator corresponds to real computational work.
   */
  const runAnalysis = async (
    orig = originalText,
    trans = transformedText,
    type = transformationType,
    mode = engineMode,
    activeWeights = weights
  ) => {
    if (!orig.trim() || !trans.trim()) return;
    setErrorMsg(null);
    setIsAnalyzing(true);

    try {
      // Step 1: Reading source message
      setAnalysisStepIndex(0);
      const origPre = preprocessText(orig);
      const transPre = preprocessText(trans);
      setAnalysisStepDetail(
        `Segmented ${origPre.sentences.length} source sentence(s) and ${transPre.sentences.length} transformed sentence(s).`
      );
      await sleep(130);

      let computed: AnalysisResult;

      if (mode === 'deterministic') {
        // Step 2: Extracting critical meaning units
        setAnalysisStepIndex(1);
        const units = extractCriticalUnits(orig, activeWeights);
        setAnalysisStepDetail(`Extracted ${units.length} critical meaning unit(s).`);
        await sleep(140);

        // Step 3: Checking obligations, dates, numbers & conditions
        setAnalysisStepIndex(2);
        const obCount = units.filter((u) => u.type === 'OBLIGATION' || u.type === 'NEGATION').length;
        const dtCount = units.filter(
          (u) => u.type === 'DATE' || u.type === 'TIME' || u.type === 'DEADLINE'
        ).length;
        const numCount = units.filter((u) => u.type === 'QUANTITY' || u.type === 'MONEY').length;
        setAnalysisStepDetail(
          `Detected ${obCount} obligation/negation, ${dtCount} date/time, and ${numCount} numeric unit(s).`
        );
        await sleep(140);

        // Step 4: Comparing transformed meaning
        setAnalysisStepIndex(3);
        const comparisons = compareUnitsAgainstTransformed(units, trans);
        setAnalysisStepDetail(`Aligned ${comparisons.length} unit(s) against transformed text.`);
        await sleep(140);

        // Step 5: Assessing criticality
        setAnalysisStepIndex(4);
        const scoreOutcome = calculateScoreAndExplanations(comparisons);
        const baseline = computeBaselineSimilarity(orig, trans, comparisons);
        setAnalysisStepDetail(
          `Weighted Meaning Integrity = ${scoreOutcome.preservationScore}% vs. Surface Cosine = ${baseline.cosineSimilarityPct}%.`
        );
        await sleep(130);

        // Step 6: Generating explanation
        setAnalysisStepIndex(5);
        computed = analyzeWithDeterministicEngine(orig, trans, {
          transformationType: type,
          sourceLanguage,
          targetLanguage,
          weights: activeWeights,
        });
        setAnalysisStepDetail(
          `Generated ${computed.explanations.length} decision-impact explanation(s).`
        );
        await sleep(120);
      } else {
        setAnalysisStepIndex(1);
        setAnalysisStepDetail('Extracting structured meaning units via semantic analyzer...');
        await sleep(120);
        setAnalysisStepIndex(3);
        setAnalysisStepDetail('Comparing transformed meaning & computing weighted criticality...');
        try {
          const resp = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              originalText: orig,
              transformedText: trans,
              transformationType: type,
              sourceLanguage,
              targetLanguage,
              mode,
              weights: activeWeights,
            }),
          });
          if (!resp.ok) throw new Error(`Server responded with ${resp.status}`);
          computed = (await resp.json()) as AnalysisResult;
        } catch {
          computed = analyzeWithDeterministicEngine(orig, trans, {
            transformationType: type,
            sourceLanguage,
            targetLanguage,
            weights: activeWeights,
          });
          computed.trace.fallbackTriggered = true;
          computed.trace.fallbackReason =
            'Server semantic endpoint unreachable; executed local deterministic NLP & rule engine.';
        }
        setAnalysisStepIndex(5);
        setAnalysisStepDetail('Finalizing decision-impact explanations...');
        await sleep(120);
      }

      setResult(computed);
      setAnalyzeViewMode('results');
      scrollToTop();
    } finally {
      setIsAnalyzing(false);
      setAnalysisStepDetail(null);
    }
  };

  const handlePopulateDemo = (demoId: string) => {
    const demo = DEMO_SCENARIOS.find((d) => d.id === demoId);
    if (!demo) return;
    setActiveTab('analyze');
    setAnalyzeViewMode('workspace');
    setOriginalText(demo.originalText);
    setTransformedText(demo.transformedText);
    setTransformationType(demo.transformationType);
    setTargetLanguage('en');
    setResult(null);
    setErrorMsg(null);
    scrollToTop();
  };

  const handleClear = () => {
    setOriginalText('');
    setTransformedText('');
    setResult(null);
    setErrorMsg(null);
    setAnalyzeViewMode('workspace');
  };

  const handleInspectCase = (orig: string, trans: string, type: TransformationType) => {
    setActiveTab('analyze');
    setOriginalText(orig);
    setTransformedText(trans);
    setTransformationType(type);
    setTargetLanguage('en');
    void runAnalysis(orig, trans, type, engineMode, weights);
  };

  const handleUpdateWeight = (type: CriticalUnitType, value: number) => {
    setWeights((prev) => ({
      ...prev,
      byType: {
        ...prev.byType,
        [type]: value,
      },
    }));
  };

  const handleResetWeights = () => {
    const reset: ImportanceWeightConfig = {
      ...DEFAULT_PROTOTYPE_WEIGHTS,
      byType: { ...DEFAULT_PROTOTYPE_WEIGHTS.byType },
    };
    setWeights(reset);
    if (originalText.trim() && transformedText.trim() && analyzeViewMode === 'results') {
      void runAnalysis(originalText, transformedText, transformationType, engineMode, reset);
    }
  };

  const navItems: { id: NavTab; label: string; mobileLabel: string; Icon: typeof ScanSearch }[] = [
    { id: 'analyze', label: 'Analyze', mobileLabel: 'Analyze', Icon: ScanSearch },
    { id: 'chain', label: 'Meaning Chain', mobileLabel: 'Chain', Icon: GitCommitHorizontal },
    { id: 'experiments', label: 'Experiments', mobileLabel: 'Eval Lab', Icon: FlaskConical },
    { id: 'about', label: 'About', mobileLabel: 'About', Icon: BookOpen },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 overflow-x-hidden">
      {/* Compact Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
          <button
            type="button"
            onClick={() => {
              setActiveTab('analyze');
              setAnalyzeViewMode('workspace');
              scrollToTop();
            }}
            className="flex flex-col items-start text-left shrink-0 cursor-pointer"
          >
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-none">
              MEANLOCK
            </span>
            <span className="text-[9px] sm:text-[10px] font-semibold tracking-widest uppercase text-slate-500 mt-1 leading-none">
              Critical Meaning Intelligence
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium" aria-label="Primary">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    scrollToTop();
                  }}
                  className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'border-slate-900 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0 text-xs font-medium text-slate-700">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                engineReady ? 'bg-emerald-600' : 'bg-amber-500'
              }`}
              aria-hidden="true"
            />
            <span className="whitespace-nowrap">
              {engineReady ? 'Analysis Engine Ready' : 'Engine Initializing'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-24 md:pb-10">
        {activeTab === 'analyze' && (
          <AnalyzeView
            viewMode={analyzeViewMode}
            originalText={originalText}
            transformedText={transformedText}
            transformationType={transformationType}
            sourceLanguage={sourceLanguage}
            targetLanguage={targetLanguage}
            engineMode={engineMode}
            geminiAvailable={geminiAvailable}
            weights={weights}
            result={result}
            isAnalyzing={isAnalyzing}
            analysisStepIndex={analysisStepIndex}
            analysisStepDetail={analysisStepDetail}
            errorMsg={errorMsg}
            onBackToWorkspace={() => {
              setAnalyzeViewMode('workspace');
              scrollToTop();
            }}
            onChangeOriginal={setOriginalText}
            onChangeTransformed={setTransformedText}
            onChangeTransformationType={setTransformationType}
            onChangeTargetLanguage={setTargetLanguage}
            onChangeEngineMode={setEngineMode}
            onPopulateDemo={handlePopulateDemo}
            onClear={handleClear}
            onAnalyze={() => void runAnalysis()}
            onUpdateWeight={handleUpdateWeight}
            onResetWeights={handleResetWeights}
          />
        )}

        {activeTab === 'chain' && <MeaningChainView weights={weights} />}

        {activeTab === 'experiments' && (
          <ExperimentsView weights={weights} onInspectInAnalyzer={handleInspectCase} />
        )}

        {activeTab === 'about' && <AboutView onLoadFailureCase={handleInspectCase} />}
      </main>

      <footer className="hidden md:block border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4 text-xs text-slate-500">
          <span>MEANLOCK · Critical Meaning Preservation for AI-Transformed Information</span>
          <span>
            Informational meaning-verification prototype only — not legal, medical, or financial advice.
          </span>
        </div>
      </footer>

      {/* Mobile Bottom Thumb-Zone Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-4 h-16"
        aria-label="Mobile Navigation"
      >
        {navItems.map(({ id, mobileLabel, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                scrollToTop();
              }}
              className={`flex flex-col items-center justify-center gap-1 min-h-[48px] transition-colors cursor-pointer ${
                isActive ? 'text-slate-900 font-semibold' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="text-[11px] leading-none">{mobileLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
