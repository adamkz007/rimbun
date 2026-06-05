-- Rename assessment notes to diagnosis and remove legacy plan notes.

alter table encounter_notes
  drop constraint if exists encounter_notes_section_check;

delete from encounter_notes
where section = 'plan';

update encounter_notes
set
  section = 'diagnosis',
  updated_at = now()
where section = 'assessment';

alter table encounter_notes
  add constraint encounter_notes_section_check
  check (section in (
    'chief_complaint', 'history', 'examination',
    'diagnosis', 'general_notes'
  ));
