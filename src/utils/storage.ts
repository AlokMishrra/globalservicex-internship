import type { DraftFormState, FormField, FormSubmission, PublishedForm } from '../types';

const DRAFT_KEY = 'internship_form_draft';
const PUBLISHED_KEY = 'internship_published_forms';
const SUBMISSION_PREFIX = 'internship_submissions_';

const defaultDraft: DraftFormState = {
  title: 'Untitled internship form',
  description: 'Collect candidate details for your internship program.',
  fields: [],
};

const parseJSON = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const loadDraft = (): DraftFormState => {
  return parseJSON(localStorage.getItem(DRAFT_KEY), defaultDraft);
};

export const saveDraft = (draft: DraftFormState) => {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
};

export const resetDraft = () => {
  localStorage.removeItem(DRAFT_KEY);
};

export const loadPublishedForms = (): PublishedForm[] => {
  return parseJSON(localStorage.getItem(PUBLISHED_KEY), []);
};

export const savePublishedForm = (form: PublishedForm) => {
  const existing = loadPublishedForms();
  existing.unshift(form);
  localStorage.setItem(PUBLISHED_KEY, JSON.stringify(existing));
};

export const findPublishedForm = (slug: string): PublishedForm | undefined => {
  return loadPublishedForms().find((form) => form.slug === slug);
};

export const loadRecentFields = (): FormField[] => {
  return loadDraft().fields;
};

export const loadSubmissions = (formId: string): FormSubmission[] => {
  return parseJSON(localStorage.getItem(`${SUBMISSION_PREFIX}${formId}`), []);
};

export const saveSubmission = (formId: string, submission: FormSubmission) => {
  const existing = loadSubmissions(formId);
  existing.unshift(submission);
  localStorage.setItem(`${SUBMISSION_PREFIX}${formId}`, JSON.stringify(existing));
};


