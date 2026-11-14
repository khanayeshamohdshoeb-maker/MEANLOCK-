import { ExperimentCase, MeaningChainStageInput, TransformationType } from './types';

export interface DemoScenario {
  id: string;
  shortLabel: string;
  label: string;
  title: string;
  domain: string;
  transformationType: TransformationType;
  originalText: string;
  transformedText: string;
  summaryNote: string;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'demo-1-scholarship',
    shortLabel: 'Scholarship',
    label: 'Scholarship Deadline',
    title: 'Scholarship Deadline',
    domain: 'Deadline + obligation + required document',
    transformationType: 'Summarization',
    originalText:
      'Students must submit the scholarship application before 5:00 PM on 30 November. Late submissions will not be considered. Applicants must upload their income certificate.',
    transformedText:
      'Students should submit the scholarship application by November 30. Late applications may not be accepted.',
    summaryNote:
      'Tests obligation weakening ("must" to "should"), lost 5:00 PM cutoff, uncertain consequence, and lost income certificate.',
  },
  {
    id: 'demo-2-safety',
    shortLabel: 'Safety',
    label: 'Safety Instruction',
    title: 'Safety Instruction',
    domain: 'Negation + condition + consequence',
    transformationType: 'Simplification',
    originalText:
      'WARNING: Do not mix this cleaner with bleach or ammonia. Toxic chlorine gas will be released. Use only in a well-ventilated area and keep out of reach of children under 12.',
    transformedText:
      'Use this cleaner in an open area. Avoid mixing with other chemicals when possible and keep away from young children.',
    summaryNote:
      'Tests softened prohibition, lost chemical specifics, lost toxic consequence, dropped "only" restriction, and lost age threshold.',
  },
  {
    id: 'demo-3-school-form',
    shortLabel: 'School',
    label: 'School Application',
    title: 'School Application',
    domain: 'Deadline + quantity + required document',
    transformationType: 'Forwarded / Edited',
    originalText:
      'Parents must return the signed permission slip and 2 passport photos to Room 104 by 3:30 PM on October 18. A $25 lab fee is required unless the student has a fee waiver. Students without forms will not be permitted on the bus.',
    transformedText:
      'Parents should turn in the permission slip and photos to the main office by October 18. A lab fee applies for the trip.',
    summaryNote:
      'Tests lost quantity ("2"), dropped "signed" modifier, changed location ("Room 104" to "main office"), lost $25 fee, and lost exception.',
  },
  {
    id: 'demo-4-financial',
    shortLabel: 'Financial',
    label: 'Financial Notice',
    title: 'Financial Notice',
    domain: 'Money + percentage + conditional penalty',
    transformationType: 'Summarization',
    originalText:
      'A $35 late fee will be charged unless minimum payment of 10% is received before 6:00 PM on March 5. Do not send cash by mail.',
    transformedText:
      'Pay part of your balance by March 5 to avoid extra charges. Sending payment by mail is not recommended.',
    summaryNote:
      'Tests lost $35 fee, lost 10% threshold, lost 6:00 PM cutoff, dropped "unless" condition, and weakened "Do not send cash" prohibition.',
  },
  {
    id: 'demo-5-public-service',
    shortLabel: 'Public Service',
    label: 'Public-Service Instruction',
    title: 'Public-Service Instruction',
    domain: 'Negation reversal + condition + rejection consequence',
    transformationType: 'Translation',
    originalText:
      'Applicants must not submit duplicate forms. If the form is incomplete, the application will be rejected. Bring 2 proofs of residency to Window 4.',
    transformedText:
      'Applicants may submit duplicate forms. Complete forms are preferred. Bring proof of residency to the help desk.',
    summaryNote:
      'Tests critical negation reversal ("must not" to "may"), softened conditional rejection, lost quantity "2", and changed window.',
  },
];

export const DEFAULT_MEANING_CHAIN: {
  title: string;
  originalText: string;
  stages: MeaningChainStageInput[];
} = {
  title: 'Scholarship Notice: Source → Translation → Simplification → Summary',
  originalText:
    'Students must submit the scholarship application before 5:00 PM on 30 November. Late submissions will not be considered. Applicants must upload their income certificate.',
  stages: [
    {
      id: 'stage-1',
      label: 'Translation',
      transformationType: 'Translation',
      text: 'Students must submit the scholarship application before 5:00 PM on November 30. Late submissions will not be considered. Applicants must upload their income certificate.',
    },
    {
      id: 'stage-2',
      label: 'Simplification',
      transformationType: 'Simplification',
      text: 'Students should submit the scholarship application before 5:00 PM by November 30. Late applications may not be accepted. Applicants need to upload their income certificate.',
    },
    {
      id: 'stage-3',
      label: 'Summary',
      transformationType: 'Summarization',
      text: 'Students should submit the scholarship application by November 30. Late applications may not be accepted.',
    },
  ],
};

export interface FailureCase {
  id: string;
  title: string;
  category: string;
  originalText: string;
  transformedText: string;
  transformationType: TransformationType;
  whyPrototypeCanFail: string;
}

export const HONEST_FAILURE_CASES: FailureCase[] = [
  {
    id: 'fail-implied-context',
    title: 'Implied & Context-Dependent Consequence',
    category: 'Implied meaning / Context-dependent meaning',
    transformationType: 'Rewriting',
    originalText:
      'Submit your housing form before Friday if you want the fall semester room rate locked in.',
    transformedText: 'Submit your housing form before Friday.',
    whyPrototypeCanFail:
      'The rule extractor captures the deadline ("before Friday") and the "if" condition, but cannot infer the unstated financial stake (higher rent later) because no dollar amount or "penalty" keyword appears.',
  },
  {
    id: 'fail-double-negative',
    title: 'Complex Nested Double Negation',
    category: 'Ambiguous wording / Complex sentences',
    transformationType: 'Simplification',
    originalText:
      'Applications will not be accepted unless all non-refundable deposits are not unpaid by Tuesday.',
    transformedText: 'Applications are accepted when deposits are paid by Tuesday.',
    whyPrototypeCanFail:
      'Nested double negatives ("not accepted unless ... not unpaid") trigger conservative negation-reversal warnings even though the simplified sentence accurately resolves the double negative.',
  },
  {
    id: 'fail-cross-lingual',
    title: 'Cross-Lingual Modal Nuance (English → Hindi/Urdu/Marathi)',
    category: 'Multilingual nuance',
    transformationType: 'Translation',
    originalText: 'Students must bring their original transcript to Room 204.',
    transformedText:
      'छात्रों को अपनी मूल मार्कशीट कमरा 204 में लानी चाहिए। (Back-gloss: "Students should bring their original marksheet to Room 204.")',
    whyPrototypeCanFail:
      'Without validated modal lexicons for non-English scripts (e.g., Hindi "चाहिए" vs "अनिवार्य है"), the English rule prototype cannot parse Devanagari or Nastaliq directly.',
  },
];

export const EXPERIMENT_STARTER_CORPUS: ExperimentCase[] = [
  {
    id: 'EXP-01',
    title: 'Scholarship deadline & document drop',
    domain: 'Education',
    transformationType: 'Summarization',
    originalText:
      'Students must submit the scholarship application before 5:00 PM on 30 November. Late submissions will not be considered. Applicants must upload their income certificate.',
    transformedText:
      'Students should submit the scholarship application by November 30. Late applications may not be accepted.',
    expectedCriticalUnits: ['must submit', '5:00 PM', '30 November', 'will not be considered', 'income certificate'],
    expectedStatusLabel: 'LOST',
    expectedHasCriticalLoss: true,
    expectedNotes: 'Time 5 PM lost, obligation weakened, document lost, consequence uncertain.',
  },
  {
    id: 'EXP-02',
    title: 'Chemical cleaner safety label',
    domain: 'Safety',
    transformationType: 'Simplification',
    originalText:
      'WARNING: Do not mix this cleaner with bleach or ammonia. Toxic chlorine gas will be released. Use only in a well-ventilated area and keep out of reach of children under 12.',
    transformedText:
      'Use this cleaner in an open area. Avoid mixing with other chemicals when possible and keep away from young children.',
    expectedCriticalUnits: ['Do not mix', 'Toxic chlorine gas', 'only in a well-ventilated area', 'under 12'],
    expectedStatusLabel: 'LOST',
    expectedHasCriticalLoss: true,
    expectedNotes: 'Prohibition softened, toxic consequence lost, age limit 12 lost.',
  },
  {
    id: 'EXP-03',
    title: 'School trip permission & fee waiver',
    domain: 'School',
    transformationType: 'Forwarded / Edited',
    originalText:
      'Parents must return the signed permission slip and 2 passport photos to Room 104 by 3:30 PM on October 18. A $25 lab fee is required unless the student has a fee waiver. Students without forms will not be permitted on the bus.',
    transformedText:
      'Parents should turn in the permission slip and photos to the main office by October 18. A lab fee applies for the trip.',
    expectedCriticalUnits: ['signed permission slip', '2 passport photos', 'Room 104', '3:30 PM', '$25', 'unless fee waiver'],
    expectedStatusLabel: 'LOST',
    expectedHasCriticalLoss: true,
    expectedNotes: 'Quantity 2 lost, room changed, time lost, $25 lost, waiver exception lost.',
  },
  {
    id: 'EXP-04',
    title: 'Financial late fee & percentage dropped',
    domain: 'Financial',
    transformationType: 'Summarization',
    originalText:
      'A $35 late fee will be charged unless minimum payment of 10% is received before 6:00 PM on March 5. Do not send cash by mail.',
    transformedText:
      'Pay part of your balance by March 5 to avoid extra charges. Sending payment by mail is not recommended.',
    expectedCriticalUnits: ['$35', '10%', '6:00 PM', 'Do not send cash'],
    expectedStatusLabel: 'LOST',
    expectedHasCriticalLoss: true,
    expectedNotes: '$35 fee, 10% minimum, 6:00 PM time lost, prohibition weakened.',
  },
  {
    id: 'EXP-05',
    title: 'Duplicate form negation reversal',
    domain: 'Public Service',
    transformationType: 'Translation',
    originalText: 'Applicants must not submit duplicate forms.',
    transformedText: 'Applicants may submit duplicate forms.',
    expectedCriticalUnits: ['must not submit duplicate forms'],
    expectedStatusLabel: 'CHANGED',
    expectedHasCriticalLoss: true,
    expectedNotes: 'Critical negation reversal ("must not" -> "may").',
  },
  {
    id: 'EXP-06',
    title: 'Incomplete form conditional rejection softened',
    domain: 'Public Service',
    transformationType: 'Simplification',
    originalText: 'If the form is incomplete, the application will be rejected.',
    transformedText: 'Complete forms are preferred.',
    expectedCriticalUnits: ['If the form is incomplete', 'will be rejected'],
    expectedStatusLabel: 'CHANGED',
    expectedHasCriticalLoss: true,
    expectedNotes: 'Binding conditional rejection altered into soft preference.',
  },
  {
    id: 'EXP-07',
    title: 'Exam hall safe translation equivalent',
    domain: 'Education',
    transformationType: 'Translation',
    originalText: 'Students must bring 2 pencils and their ID card to Hall 3 at 8:00 AM.',
    transformedText: 'Students are required to bring 2 pencils and their ID card to Hall 3 at 08:00.',
    expectedCriticalUnits: ['must bring', '2 pencils', 'ID card', 'Hall 3', '8:00 AM'],
    expectedStatusLabel: 'PRESERVED',
    expectedHasCriticalLoss: false,
    expectedNotes: 'Control case: 8:00 AM normalized to 08:00, must -> are required to.',
  },
  {
    id: 'EXP-08',
    title: 'Library card renewal safe paraphrase',
    domain: 'Public Service',
    transformationType: 'Rewriting',
    originalText:
      'Residents must renew their library card before 6:00 PM on May 14 at Desk 2. Late renewals incur a $5 fee.',
    transformedText:
      'Residents are required to renew their library card by 6:00 PM on 14 May at Desk 2. Late renewals incur a $5 fee.',
    expectedCriticalUnits: ['must renew', '6:00 PM', 'May 14', 'Desk 2', '$5'],
    expectedStatusLabel: 'PRESERVED',
    expectedHasCriticalLoss: false,
    expectedNotes: 'Control case: date format & modal equivalent preserved.',
  },
  {
    id: 'EXP-09',
    title: 'Grant eligibility condition dropped',
    domain: 'Financial Aid',
    transformationType: 'Summarization',
    originalText: 'Students are eligible for the $500 book stipend only if enrolled in at least 12 credits.',
    transformedText: 'Students can receive a $500 book stipend.',
    expectedCriticalUnits: ['only if enrolled in at least 12 credits'],
    expectedStatusLabel: 'LOST',
    expectedHasCriticalLoss: true,
    expectedNotes: 'Eligibility condition removed.',
  },
  {
    id: 'EXP-10',
    title: 'Exact quantity dropped in permit notice',
    domain: 'Public Service',
    transformationType: 'Rewriting',
    originalText: 'Applicants must submit 3 documents and a $150 processing fee before 4:00 PM.',
    transformedText: 'Applicants must submit the required documents and a processing fee before the deadline.',
    expectedCriticalUnits: ['3 documents', '$150', '4:00 PM'],
    expectedStatusLabel: 'LOST',
    expectedHasCriticalLoss: true,
    expectedNotes: 'Quantity "3", money "$150", and time "4:00 PM" all lost.',
  },
  {
    id: 'EXP-11',
    title: 'Double negative simplification (Honest Failure Case)',
    domain: 'Administration',
    transformationType: 'Simplification',
    originalText: 'Applications will not be accepted unless deposits are not unpaid by Tuesday.',
    transformedText: 'Applications are accepted if deposits are paid by Tuesday.',
    expectedCriticalUnits: ['unless deposits are not unpaid', 'Tuesday'],
    expectedStatusLabel: 'PRESERVED',
    expectedHasCriticalLoss: false,
    expectedNotes:
      'The system flagged the resolved double-negative as a negation reversal even though human readers judge the simplified affirmative condition equivalent.',
  },
  {
    id: 'EXP-12',
    title: 'Implicit rate-lock consequence (Honest Failure Case)',
    domain: 'Housing',
    transformationType: 'Rewriting',
    originalText: 'Submit your housing form before Friday if you want the fall semester room rate locked in.',
    transformedText: 'Submit your housing form before Friday.',
    expectedCriticalUnits: ['before Friday', 'if you want the fall semester room rate locked in'],
    expectedStatusLabel: 'LOST',
    expectedHasCriticalLoss: true,
    expectedNotes:
      'If the rule engine misses the non-numeric consequence in the conditional clause, it underestimates decision risk.',
  },
];
