import type { FormField, PublishedForm } from '../types';

export const fieldTemplates: Omit<FormField, 'id'>[] = [
  {
    type: 'shortText',
    label: 'Short answer',
    required: false,
    placeholder: 'Type your response',
  },
  {
    type: 'longText',
    label: 'Paragraph',
    required: false,
    placeholder: 'Give more context or describe in detail',
  },
  {
    type: 'multipleChoice',
    label: 'Multiple choice',
    required: false,
    options: ['Option 1', 'Option 2', 'Option 3'],
  },
  {
    type: 'checkboxes',
    label: 'Checkboxes',
    required: false,
    options: ['Option 1', 'Option 2', 'Option 3'],
  },
  {
    type: 'dropdown',
    label: 'Dropdown',
    required: false,
    options: ['Option 1', 'Option 2', 'Option 3'],
  },
  {
    type: 'fileUpload',
    label: 'File upload',
    required: false,
    helperText: 'Attach resumes, proposals, or other docs.',
  },
  {
    type: 'linearScale',
    label: 'Linear scale',
    required: false,
    scale: {
      min: 1,
      max: 5,
      minLabel: 'Not at all',
      maxLabel: 'Extremely',
    },
  },
  {
    type: 'rating',
    label: 'Rating (stars)',
    required: false,
    maxRating: 5,
  },
  {
    type: 'multipleChoiceGrid',
    label: 'Multiple choice grid',
    required: false,
    rows: ['Row 1', 'Row 2'],
    columns: ['Column 1', 'Column 2'],
  },
  {
    type: 'checkboxGrid',
    label: 'Checkbox grid',
    required: false,
    rows: ['Row 1', 'Row 2'],
    columns: ['Column 1', 'Column 2'],
  },
  {
    type: 'date',
    label: 'Date',
    required: false,
  },
  {
    type: 'time',
    label: 'Time',
    required: false,
  },
];

export const createFieldFromTemplate = (template: Omit<FormField, 'id'>): FormField => ({
  ...template,
  options: template.options ? [...template.options] : undefined,
  rows: template.rows ? [...template.rows] : undefined,
  columns: template.columns ? [...template.columns] : undefined,
  scale: template.scale ? { ...template.scale } : undefined,
  id: crypto.randomUUID(),
});

export const buildSlug = (name: string) => {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const unique = Math.random().toString(36).slice(2, 7);
  return `${base || 'form'}-${unique}`;
};

export const isFormLive = (form: PublishedForm) => {
  const now = Date.now();
  return new Date(form.openAt).getTime() <= now && now <= new Date(form.closeAt).getTime();
};

export const isFormClosed = (form: PublishedForm) => {
  return Date.now() > new Date(form.closeAt).getTime();
};

export const formatDateTime = (value: string) => {
  return new Date(value).toLocaleString();
};


