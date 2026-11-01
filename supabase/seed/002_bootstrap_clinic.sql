-- Bootstrap clinic, staff accounts, and a local admin for development

do $$
declare
  v_clinic_id uuid;
  v_admin_user_id uuid;
  v_doctor_user_id uuid;
  v_nurse_user_id uuid;
  v_reception_user_id uuid;
begin
  insert into clinics (
    name,
    slug,
    address,
    phone,
    registration_number,
    settings
  )
  values (
    'Rimbun Demo Clinic',
    'rimbun-demo',
    '12 Jalan SS 21/1, Petaling Jaya',
    '+60 3-7880 1000',
    'MY-DEMO-001',
    '{
      "modules": {
        "clerking": true,
        "queue": true,
        "billing": false,
        "dispensary": false,
        "attendance": false,
        "loop": true
      }
    }'::jsonb
  )
  on conflict (slug) do update
  set
    name = excluded.name,
    address = excluded.address,
    phone = excluded.phone,
    registration_number = excluded.registration_number,
    settings = excluded.settings
  returning id into v_clinic_id;

  select id into v_admin_user_id from auth.users where email = 'admin@demo.rimbun.local';
  if v_admin_user_id is null then
    v_admin_user_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      v_admin_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'admin@demo.rimbun.local',
      crypt('Rimbun123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Aisyah Admin","role":"admin"}'::jsonb,
      now(),
      now()
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      v_admin_user_id,
      v_admin_user_id,
      format('{"sub":"%s","email":"admin@demo.rimbun.local"}', v_admin_user_id)::jsonb,
      'email',
      v_admin_user_id::text,
      now(),
      now(),
      now()
    );
  end if;

  select id into v_doctor_user_id from auth.users where email = 'doctor@demo.rimbun.local';
  if v_doctor_user_id is null then
    v_doctor_user_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      v_doctor_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'doctor@demo.rimbun.local',
      crypt('Rimbun123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Dr. Hakim Rahman","role":"doctor"}'::jsonb,
      now(),
      now()
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      v_doctor_user_id,
      v_doctor_user_id,
      format('{"sub":"%s","email":"doctor@demo.rimbun.local"}', v_doctor_user_id)::jsonb,
      'email',
      v_doctor_user_id::text,
      now(),
      now(),
      now()
    );
  end if;

  select id into v_nurse_user_id from auth.users where email = 'nurse@demo.rimbun.local';
  if v_nurse_user_id is null then
    v_nurse_user_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      v_nurse_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'nurse@demo.rimbun.local',
      crypt('Rimbun123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Siti Nur","role":"nurse"}'::jsonb,
      now(),
      now()
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      v_nurse_user_id,
      v_nurse_user_id,
      format('{"sub":"%s","email":"nurse@demo.rimbun.local"}', v_nurse_user_id)::jsonb,
      'email',
      v_nurse_user_id::text,
      now(),
      now(),
      now()
    );
  end if;

  select id into v_reception_user_id from auth.users where email = 'reception@demo.rimbun.local';
  if v_reception_user_id is null then
    v_reception_user_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      v_reception_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'reception@demo.rimbun.local',
      crypt('Rimbun123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Farah Desk","role":"receptionist"}'::jsonb,
      now(),
      now()
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      v_reception_user_id,
      v_reception_user_id,
      format('{"sub":"%s","email":"reception@demo.rimbun.local"}', v_reception_user_id)::jsonb,
      'email',
      v_reception_user_id::text,
      now(),
      now(),
      now()
    );
  end if;

  insert into staff (
    auth_user_id,
    clinic_id,
    email,
    full_name,
    role,
    mmc_number,
    is_active
  )
  values
    (
      v_admin_user_id,
      v_clinic_id,
      'admin@demo.rimbun.local',
      'Aisyah Admin',
      'admin',
      null,
      true
    ),
    (
      v_doctor_user_id,
      v_clinic_id,
      'doctor@demo.rimbun.local',
      'Dr. Hakim Rahman',
      'doctor',
      'MMC-123456',
      true
    ),
    (
      v_nurse_user_id,
      v_clinic_id,
      'nurse@demo.rimbun.local',
      'Siti Nur',
      'nurse',
      null,
      true
    ),
    (
      v_reception_user_id,
      v_clinic_id,
      'reception@demo.rimbun.local',
      'Farah Desk',
      'receptionist',
      null,
      true
    )
  on conflict (auth_user_id) do update
  set
    clinic_id = excluded.clinic_id,
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    mmc_number = excluded.mmc_number,
    is_active = excluded.is_active;

  -- GoTrue cannot read hand-inserted users whose token columns are NULL.
  update auth.users
  set
    confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, '')
  where email like '%@demo.rimbun.local';
end $$;
