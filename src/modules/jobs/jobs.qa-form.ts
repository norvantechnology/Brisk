import { BadRequestError } from '../../utils/errors';
import type { QaFormField } from '../admin/admin-categories/admin-categories.types';

export type QaFormAnswerValue = string | number | boolean | string[];
export type QaFormAnswers = Record<string, QaFormAnswerValue>;

const CHOICE_TYPES = new Set(['dropdown', 'single_choice', 'multi_choice']);

export const parseQaFormSchema = (schema: unknown): QaFormField[] =>
  Array.isArray(schema)
    ? (schema as QaFormField[]).filter((f) => f && typeof f.id === 'string' && typeof f.type === 'string')
    : [];

const isEmptyAnswer = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

const invalid = (field: QaFormField, reason: string) =>
  new BadRequestError(`"${field.label}" ${reason}`);

const normalizeAnswer = (field: QaFormField, raw: unknown): QaFormAnswerValue => {
  const optionValues = new Set((field.options ?? []).map((o) => o.value));

  switch (field.type) {
    case 'text':
    case 'textarea':
      if (typeof raw !== 'string') throw invalid(field, 'must be text.');
      return raw.trim();

    case 'number': {
      const num = typeof raw === 'string' ? Number(raw.trim()) : raw;
      if (typeof num !== 'number' || !Number.isFinite(num)) throw invalid(field, 'must be a number.');
      if (field.min != null && num < field.min) throw invalid(field, `must be at least ${field.min}.`);
      if (field.max != null && num > field.max) throw invalid(field, `must be at most ${field.max}.`);
      return num;
    }

    case 'dropdown':
    case 'single_choice':
      if (typeof raw !== 'string' || !optionValues.has(raw)) {
        throw invalid(field, 'has an invalid option selected.');
      }
      return raw;

    case 'multi_choice': {
      const values = Array.isArray(raw) ? raw : [raw];
      if (!values.every((v) => typeof v === 'string' && optionValues.has(v))) {
        throw invalid(field, 'has an invalid option selected.');
      }
      return Array.from(new Set(values as string[]));
    }

    case 'date': {
      if (typeof raw !== 'string' || Number.isNaN(Date.parse(raw.trim()))) {
        throw invalid(field, 'must be a valid date.');
      }
      return raw.trim();
    }

    case 'boolean':
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true' || raw === 'false') return raw === 'true';
      throw invalid(field, 'must be true or false.');

    default:
      throw invalid(field, 'has an unsupported field type.');
  }
};

/**
 * Validates answers against the sub-category admin form.
 * Unknown field ids are dropped; empty answers are omitted. Required fields are checked at publish.
 */
export const normalizeQaFormAnswers = (schema: unknown, answers: unknown): QaFormAnswers => {
  const fields = parseQaFormSchema(schema);
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return {};

  const input = answers as Record<string, unknown>;
  const result: QaFormAnswers = {};
  for (const field of fields) {
    const raw = input[field.id];
    if (isEmptyAnswer(raw)) continue;
    result[field.id] = normalizeAnswer(field, raw);
  }
  return result;
};

export const assertRequiredQaFormAnswers = (schema: unknown, answers: unknown) => {
  const fields = parseQaFormSchema(schema);
  const input = (answers && typeof answers === 'object' ? answers : {}) as Record<string, unknown>;
  const missing = fields.filter((f) => f.required && isEmptyAnswer(input[f.id]));
  if (missing.length) {
    throw new BadRequestError(
      `Please answer the required question${missing.length > 1 ? 's' : ''}: ${missing
        .map((f) => f.label)
        .join(', ')}.`
    );
  }
};

/** Answered questions in admin form order, with option labels resolved for display. */
export const buildQaFormAnswerList = (schema: unknown, answers: unknown) => {
  const fields = parseQaFormSchema(schema);
  const input = (answers && typeof answers === 'object' ? answers : {}) as Record<string, unknown>;

  return fields
    .filter((field) => !isEmptyAnswer(input[field.id]))
    .map((field) => {
      const value = input[field.id] as QaFormAnswerValue;
      const labelFor = (v: unknown) =>
        field.options?.find((o) => o.value === v)?.label ?? String(v);

      let displayValue: string;
      if (CHOICE_TYPES.has(field.type)) {
        displayValue = (Array.isArray(value) ? value : [value]).map(labelFor).join(', ');
      } else if (field.type === 'boolean') {
        displayValue = value === true || value === 'true' ? 'Yes' : 'No';
      } else {
        displayValue = String(value);
      }

      return {
        fieldId: field.id,
        label: field.label,
        type: field.type,
        value,
        displayValue,
      };
    });
};
