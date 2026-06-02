export type Database = {
  public: {
    Tables: {
      clinics: {
        Row: {
          id: string;
          name: string;
          slug: string;
          address: string | null;
          phone: string | null;
          registration_number: string | null;
          logo_url: string | null;
          opening_hours: ClinicOpeningHours;
          settings: ClinicSettings;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["clinics"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["clinics"]["Insert"]>;
      };
      staff: {
        Row: {
          id: string;
          auth_user_id: string;
          clinic_id: string;
          email: string;
          full_name: string;
          role: StaffRole;
          mmc_number: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["staff"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["staff"]["Insert"]>;
      };
      patients: {
        Row: {
          id: string;
          clinic_id: string;
          ic_number: string | null;
          mrn: string;
          full_name: string;
          date_of_birth: string | null;
          gender: "male" | "female" | "other" | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          allergies: string[];
          medical_history: Record<string, unknown>;
          archived_at: string | null;
          archived_reason: string | null;
          merged_into_patient_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["patients"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["patients"]["Insert"]>;
      };
      encounters: {
        Row: {
          id: string;
          clinic_id: string;
          patient_id: string;
          doctor_id: string;
          encounter_date: string;
          status: EncounterStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["encounters"]["Row"], "id" | "created_at" | "updated_at" | "encounter_date">;
        Update: Partial<Database["public"]["Tables"]["encounters"]["Insert"]>;
      };
      encounter_vitals: {
        Row: {
          id: string;
          encounter_id: string;
          blood_pressure_systolic: number | null;
          blood_pressure_diastolic: number | null;
          heart_rate: number | null;
          temperature: number | null;
          respiratory_rate: number | null;
          spo2: number | null;
          weight: number | null;
          height: number | null;
          bmi: number | null;
          recorded_by: string | null;
          recorded_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["encounter_vitals"]["Row"], "id" | "recorded_at">;
        Update: Partial<Database["public"]["Tables"]["encounter_vitals"]["Insert"]>;
      };
      encounter_notes: {
        Row: {
          id: string;
          encounter_id: string;
          section: NoteSection;
          content: Record<string, unknown>;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["encounter_notes"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["encounter_notes"]["Insert"]>;
      };
      encounter_diagnoses: {
        Row: {
          id: string;
          encounter_id: string;
          icd10_code: string;
          icd10_description: string;
          diagnosis_type: "primary" | "secondary";
          notes: string | null;
          sort_order: number;
        };
        Insert: Omit<Database["public"]["Tables"]["encounter_diagnoses"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["encounter_diagnoses"]["Insert"]>;
      };
      encounter_prescriptions: {
        Row: {
          id: string;
          encounter_id: string;
          drug_id: string | null;
          drug_name: string;
          dosage: string;
          frequency: string;
          duration: string;
          quantity: number;
          route: DrugRoute;
          instructions: string | null;
          is_dispensed: boolean;
          sort_order: number;
        };
        Insert: Omit<Database["public"]["Tables"]["encounter_prescriptions"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["encounter_prescriptions"]["Insert"]>;
      };
      encounter_scratchpads: {
        Row: {
          id: string;
          encounter_id: string;
          canvas_data: Record<string, unknown>;
          thumbnail_url: string | null;
          label: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["encounter_scratchpads"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["encounter_scratchpads"]["Insert"]>;
      };
      icd10_codes: {
        Row: {
          id: string;
          code: string;
          description: string;
          category: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["icd10_codes"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["icd10_codes"]["Insert"]>;
      };
      drugs: {
        Row: {
          id: string;
          name: string;
          generic_name: string | null;
          formulation: string | null;
          strength: string | null;
          manufacturer: string | null;
          is_controlled: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["drugs"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["drugs"]["Insert"]>;
      };
      audit_logs: {
        Row: {
          id: string;
          clinic_id: string;
          actor_staff_id: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          details: Record<string, unknown>;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audit_logs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
      };
    };
    Functions: {
      get_user_clinic_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
  };
};

export type StaffRole = "admin" | "doctor" | "nurse" | "receptionist";
export type EncounterStatus = "in_progress" | "completed" | "amended";
export type NoteSection = "chief_complaint" | "history" | "examination" | "assessment" | "plan" | "general_notes";
export type DrugRoute = "oral" | "topical" | "injection" | "inhalation" | "sublingual" | "rectal" | "other";

export type ClinicOpeningHoursDay = {
  isOpen: boolean;
  open: string;
  close: string;
};

export type ClinicOpeningHours = {
  monday: ClinicOpeningHoursDay;
  tuesday: ClinicOpeningHoursDay;
  wednesday: ClinicOpeningHoursDay;
  thursday: ClinicOpeningHoursDay;
  friday: ClinicOpeningHoursDay;
  saturday: ClinicOpeningHoursDay;
  sunday: ClinicOpeningHoursDay;
};

export type ClinicSettings = {
  modules?: {
    clerking?: boolean;
    queue?: boolean;
    billing?: boolean;
    dispensary?: boolean;
    attendance?: boolean;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
