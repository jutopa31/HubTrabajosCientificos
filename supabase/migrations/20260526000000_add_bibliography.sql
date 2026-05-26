alter table papers
  add column bibliography jsonb not null default '[]';
