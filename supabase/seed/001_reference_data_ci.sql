-- Minimal ICD-10 and drug fixtures for CI integration and E2E tests

COPY icd10_codes (code, description, category) FROM stdin;
E11.9	Type 2 Diabetes Mellitus Without Complications	Endocrine, nutritional and metabolic diseases
I10	Essential (Primary) Hypertension	Diseases of the circulatory system
\.

COPY drugs (name, generic_name, formulation, strength, manufacturer, is_controlled) FROM stdin;
Metformin 500 Mg Tablet	Metformin	Tablet	500MG	Rimbun Demo Pharma	false
Amlodipine 5 Mg Tablet	Amlodipine	Tablet	5MG	Rimbun Demo Pharma	false
\.
