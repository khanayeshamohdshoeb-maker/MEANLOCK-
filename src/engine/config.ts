import { CriticalUnitType, ImportanceWeightConfig, LanguageSupport, UnitStatus } from './types';

/**
 * PROTOTYPE WEIGHTS — NOT SCIENTIFICALLY VALIDATED
 * Weights are explicitly configurable so researchers can tune and evaluate
 * sensitivity during experiments.
 */
export const DEFAULT_PROTOTYPE_WEIGHTS: ImportanceWeightConfig = {
  HIGH: 3.0,
  MEDIUM: 2.0,
  LOW: 1.0,
  byType: {
    NEGATION: 3.5,
    WARNING: 3.5,
    DEADLINE: 3.0,
    TIME: 3.0,
    DATE: 3.0,
    OBLIGATION: 3.0,
    CONSEQUENCE: 3.0,
    MONEY: 3.0,
    ACTION: 2.5,
    DOCUMENT: 2.5,
    EXCEPTION: 2.5,
    CONDITION: 2.0,
    QUANTITY: 2.0,
    LOCATION: 2.0,
    PERMISSION: 2.0,
    CONTACT: 1.5,
    WHO: 1.0,
  },
};

export const UNIT_IMPORTANCE_TIER: Record<CriticalUnitType, 'HIGH' | 'MEDIUM' | 'LOW'> = {
  NEGATION: 'HIGH',
  WARNING: 'HIGH',
  DEADLINE: 'HIGH',
  TIME: 'HIGH',
  DATE: 'HIGH',
  OBLIGATION: 'HIGH',
  CONSEQUENCE: 'HIGH',
  MONEY: 'HIGH',
  ACTION: 'HIGH',
  DOCUMENT: 'MEDIUM',
  EXCEPTION: 'MEDIUM',
  CONDITION: 'MEDIUM',
  QUANTITY: 'MEDIUM',
  LOCATION: 'MEDIUM',
  PERMISSION: 'MEDIUM',
  CONTACT: 'LOW',
  WHO: 'LOW',
};

export const STATUS_SCORE_MULTIPLIER: Record<UnitStatus, number> = {
  PRESERVED: 1.0,
  WEAKENED: 0.45,
  CHANGED: 0.15,
  LOST: 0.0,
};

export const UNIT_WHY_IT_MATTERS: Record<CriticalUnitType, string> = {
  WHO: 'Defines who is subject to the rule or eligible for action.',
  OBLIGATION: 'Determines whether an action is mandatory, recommended, or optional.',
  PERMISSION: 'Clarifies what the recipient is allowed or authorized to do.',
  NEGATION: 'Reverses or restricts behavior; dropping negation flips instructions.',
  DEADLINE: 'Sets the cutoff constraint after which penalties or rejection apply.',
  DATE: 'Specifies the exact calendar date for action or eligibility.',
  TIME: 'Specifies the exact hour/minute cutoff on the deadline day.',
  QUANTITY: 'Defines exact counts, limits, or thresholds required to comply.',
  MONEY: 'Specifies fees, fines, stipends, or financial thresholds.',
  DOCUMENT: 'Identifies required forms, certificates, or proof needed for submission.',
  CONDITION: 'Specifies eligibility rules or prerequisites that govern the action.',
  EXCEPTION: 'Identifies cases where the standard rule or penalty does not apply.',
  WARNING: 'Highlights safety hazards or prohibited actions that prevent harm.',
  CONSEQUENCE: 'Explains what happens if instructions are missed or violated.',
  ACTION: 'Specifies the concrete task the recipient must perform.',
  LOCATION: 'Identifies the physical room, office, or digital portal required.',
  CONTACT: 'Provides phone, email, or person to reach for help or submission.',
};

export const UNIT_TYPE_LABELS: Record<CriticalUnitType, string> = {
  WHO: 'Who / Audience',
  OBLIGATION: 'Obligation',
  PERMISSION: 'Permission',
  NEGATION: 'Negation / Restriction',
  DEADLINE: 'Deadline',
  DATE: 'Date',
  TIME: 'Exact Time',
  QUANTITY: 'Quantity / Limit',
  MONEY: 'Monetary Amount',
  DOCUMENT: 'Required Document',
  CONDITION: 'Condition',
  EXCEPTION: 'Exception',
  WARNING: 'Safety Warning',
  CONSEQUENCE: 'Consequence',
  ACTION: 'Required Action',
  LOCATION: 'Location / Portal',
  CONTACT: 'Contact Info',
};

export const LANGUAGE_REGISTRY: LanguageSupport[] = [
  {
    code: 'en',
    label: 'English',
    status: 'supported',
    note: 'Primary active language for deterministic rules & NLP baseline.',
  },
  {
    code: 'hi',
    label: 'Hindi (हिन्दी)',
    status: 'planned',
    note: 'Architecture slot reserved; not yet validated for rule-based extraction.',
  },
  {
    code: 'ur',
    label: 'Urdu (اردو)',
    status: 'planned',
    note: 'Architecture slot reserved; not yet validated for rule-based extraction.',
  },
  {
    code: 'mr',
    label: 'Marathi (मराठी)',
    status: 'planned',
    note: 'Architecture slot reserved; not yet validated for rule-based extraction.',
  },
];
