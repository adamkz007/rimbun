"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PATIENT_GENDERS,
  type PatientFieldErrors,
  type PatientFormValues,
} from "@/lib/patients";

type PatientFormFieldsProps = {
  values: PatientFormValues;
  errors?: PatientFieldErrors;
  disabled?: boolean;
  idPrefix: string;
  onChange: <K extends keyof PatientFormValues>(
    field: K,
    value: PatientFormValues[K]
  ) => void;
};

export function PatientFormFields({
  values,
  errors,
  disabled = false,
  idPrefix,
  onChange,
}: PatientFormFieldsProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm font-medium">Identity</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            id={`${idPrefix}-full-name`}
            label="Full Name"
            error={errors?.fullName}
            required
          >
            <Input
              id={`${idPrefix}-full-name`}
              value={values.fullName}
              onChange={(event) => onChange("fullName", event.target.value)}
              disabled={disabled}
              aria-invalid={Boolean(errors?.fullName)}
            />
          </Field>
          <Field
            id={`${idPrefix}-ic-number`}
            label="IC Number"
            error={errors?.icNumber}
          >
            <Input
              id={`${idPrefix}-ic-number`}
              value={values.icNumber}
              onChange={(event) => onChange("icNumber", event.target.value)}
              disabled={disabled}
              aria-invalid={Boolean(errors?.icNumber)}
              placeholder="e.g. 900101-01-1234"
            />
          </Field>
          <Field
            id={`${idPrefix}-date-of-birth`}
            label="Date Of Birth"
            error={errors?.dateOfBirth}
          >
            <Input
              id={`${idPrefix}-date-of-birth`}
              type="date"
              value={values.dateOfBirth}
              onChange={(event) => onChange("dateOfBirth", event.target.value)}
              disabled={disabled}
              aria-invalid={Boolean(errors?.dateOfBirth)}
            />
          </Field>
          <Field id={`${idPrefix}-gender`} label="Gender" error={errors?.gender}>
            <select
              id={`${idPrefix}-gender`}
              value={values.gender}
              onChange={(event) =>
                onChange("gender", event.target.value as PatientFormValues["gender"])
              }
              disabled={disabled}
              aria-invalid={Boolean(errors?.gender)}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">Unspecified</option>
              {PATIENT_GENDERS.map((gender) => (
                <option key={gender} value={gender}>
                  {gender.charAt(0).toUpperCase() + gender.slice(1)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Contact</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id={`${idPrefix}-phone`} label="Phone" error={errors?.phone}>
            <Input
              id={`${idPrefix}-phone`}
              type="tel"
              value={values.phone}
              onChange={(event) => onChange("phone", event.target.value)}
              disabled={disabled}
              aria-invalid={Boolean(errors?.phone)}
            />
          </Field>
          <Field id={`${idPrefix}-email`} label="Email" error={errors?.email}>
            <Input
              id={`${idPrefix}-email`}
              type="email"
              value={values.email}
              onChange={(event) => onChange("email", event.target.value)}
              disabled={disabled}
              aria-invalid={Boolean(errors?.email)}
            />
          </Field>
        </div>
        <Field id={`${idPrefix}-address`} label="Address" error={errors?.address}>
          <Textarea
            id={`${idPrefix}-address`}
            value={values.address}
            onChange={(event) => onChange("address", event.target.value)}
            disabled={disabled}
            aria-invalid={Boolean(errors?.address)}
            className="min-h-20"
          />
        </Field>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Emergency Contact</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            id={`${idPrefix}-emergency-name`}
            label="Contact Name"
            error={errors?.emergencyContactName}
          >
            <Input
              id={`${idPrefix}-emergency-name`}
              value={values.emergencyContactName}
              onChange={(event) => onChange("emergencyContactName", event.target.value)}
              disabled={disabled}
              aria-invalid={Boolean(errors?.emergencyContactName)}
            />
          </Field>
          <Field
            id={`${idPrefix}-emergency-phone`}
            label="Contact Phone"
            error={errors?.emergencyContactPhone}
          >
            <Input
              id={`${idPrefix}-emergency-phone`}
              type="tel"
              value={values.emergencyContactPhone}
              onChange={(event) => onChange("emergencyContactPhone", event.target.value)}
              disabled={disabled}
              aria-invalid={Boolean(errors?.emergencyContactPhone)}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Clinical Summary</p>
        <Field id={`${idPrefix}-allergies`} label="Allergies" error={errors?.allergies}>
          <Input
            id={`${idPrefix}-allergies`}
            value={values.allergies}
            onChange={(event) => onChange("allergies", event.target.value)}
            disabled={disabled}
            aria-invalid={Boolean(errors?.allergies)}
            placeholder="Comma-separated"
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            id={`${idPrefix}-conditions`}
            label="Medical Conditions"
            error={errors?.medicalConditions}
          >
            <Textarea
              id={`${idPrefix}-conditions`}
              value={values.medicalConditions}
              onChange={(event) => onChange("medicalConditions", event.target.value)}
              disabled={disabled}
              aria-invalid={Boolean(errors?.medicalConditions)}
            />
          </Field>
          <Field
            id={`${idPrefix}-current-medications`}
            label="Current Medications"
            error={errors?.currentMedications}
          >
            <Textarea
              id={`${idPrefix}-current-medications`}
              value={values.currentMedications}
              onChange={(event) => onChange("currentMedications", event.target.value)}
              disabled={disabled}
              aria-invalid={Boolean(errors?.currentMedications)}
            />
          </Field>
          <Field
            id={`${idPrefix}-surgical-history`}
            label="Surgical History"
            error={errors?.surgicalHistory}
          >
            <Textarea
              id={`${idPrefix}-surgical-history`}
              value={values.surgicalHistory}
              onChange={(event) => onChange("surgicalHistory", event.target.value)}
              disabled={disabled}
              aria-invalid={Boolean(errors?.surgicalHistory)}
            />
          </Field>
          <Field
            id={`${idPrefix}-family-history`}
            label="Family History"
            error={errors?.familyHistory}
          >
            <Textarea
              id={`${idPrefix}-family-history`}
              value={values.familyHistory}
              onChange={(event) => onChange("familyHistory", event.target.value)}
              disabled={disabled}
              aria-invalid={Boolean(errors?.familyHistory)}
            />
          </Field>
          <Field
            id={`${idPrefix}-social-history`}
            label="Social History"
            error={errors?.socialHistory}
          >
            <Textarea
              id={`${idPrefix}-social-history`}
              value={values.socialHistory}
              onChange={(event) => onChange("socialHistory", event.target.value)}
              disabled={disabled}
              aria-invalid={Boolean(errors?.socialHistory)}
            />
          </Field>
          <Field
            id={`${idPrefix}-medical-notes`}
            label="Medical Notes"
            error={errors?.medicalNotes}
          >
            <Textarea
              id={`${idPrefix}-medical-notes`}
              value={values.medicalNotes}
              onChange={(event) => onChange("medicalNotes", event.target.value)}
              disabled={disabled}
              aria-invalid={Boolean(errors?.medicalNotes)}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  required = false,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
