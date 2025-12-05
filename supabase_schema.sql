-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Forms Table
create table if not exists forms (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  description text,
  status text check (status in ('published', 'unpublished')) default 'unpublished',
  fields jsonb default '[]'::jsonb,
  theme jsonb default '{}'::jsonb,
  open_at timestamptz,
  close_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  job_type text,
  department text,
  location text,
  experience text,
  skills text[],
  seo_title text,
  seo_description text,
  seo_keywords text[]
);

-- Submissions Table
create table if not exists submissions (
  id uuid primary key default uuid_generate_v4(),
  form_id uuid references forms(id) on delete cascade,
  values jsonb default '{}'::jsonb,
  submitted_at timestamptz default now(),
  applicant_key text
);

-- RLS Policies
alter table forms enable row level security;
alter table submissions enable row level security;

-- Public read access for published forms
create policy "Public forms are viewable by everyone"
  on forms for select
  using (status = 'published');

-- Admin full access to forms
create policy "Admins can do everything with forms"
  on forms for all
  using (auth.role() = 'authenticated');

-- Public can insert submissions
create policy "Public can insert submissions"
  on submissions for insert
  with check (true);

-- Admin full access to submissions
create policy "Admins can do everything with submissions"
  on submissions for all
  using (auth.role() = 'authenticated');
