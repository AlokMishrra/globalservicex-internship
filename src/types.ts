export type FieldType =
  | 'shortText'
  | 'longText'
  | 'email'
  | 'number'
  | 'dropdown'
  | 'multipleChoice'
  | 'checkboxes'
  | 'fileUpload'
  | 'linearScale'
  | 'rating'
  | 'multipleChoiceGrid'
  | 'checkboxGrid'
  | 'date'
  | 'time';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  helperText?: string;
  rows?: string[];
  columns?: string[];
  scale?: {
    min: number;
    max: number;
    minLabel?: string;
    maxLabel?: string;
  };
  maxRating?: number;
}

export interface DraftFormState {
  title: string;
  description: string;
  fields: FormField[];
  theme?: FormTheme;
}

export interface FormTheme {
  headerColor?: string;
  backgroundColor?: string;
  textColor?: string;
  primaryColor?: string;
  headerFont?: string;
  questionFont?: string;
  textFont?: string;
  headerImage?: string; // base64 or URL
  logo?: string; // base64 or URL
  logoText?: string;
}

export interface PublishedForm {
  id: string;
  slug: string;
  name: string;
  openAt: string; // ISO string
  closeAt: string; // ISO string
  fields: FormField[];
  createdAt: string;
  status: 'published' | 'unpublished';
  theme?: FormTheme;
  description?: string;
  jobType?: string;
  department?: string;
  location?: string;
  experience?: string;
  skills?: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
}

export interface FormSubmission {
  id: string;
  formId: string;
  submittedAt: string;
  values: Record<string, string>;
  applicantKey?: string;
}


