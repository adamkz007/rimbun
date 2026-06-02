alter table clinics
  add column if not exists opening_hours jsonb not null default jsonb_build_object(
    'monday', jsonb_build_object('isOpen', false, 'open', '09:00', 'close', '17:00'),
    'tuesday', jsonb_build_object('isOpen', false, 'open', '09:00', 'close', '17:00'),
    'wednesday', jsonb_build_object('isOpen', false, 'open', '09:00', 'close', '17:00'),
    'thursday', jsonb_build_object('isOpen', false, 'open', '09:00', 'close', '17:00'),
    'friday', jsonb_build_object('isOpen', false, 'open', '09:00', 'close', '17:00'),
    'saturday', jsonb_build_object('isOpen', false, 'open', '09:00', 'close', '17:00'),
    'sunday', jsonb_build_object('isOpen', false, 'open', '09:00', 'close', '17:00')
  );
