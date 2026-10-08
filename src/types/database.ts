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
          completed_at: string | null;
          completed_by: string | null;
          amendment_started_at: string | null;
          amendment_started_by: string | null;
          last_amended_at: string | null;
          last_amended_by: string | null;
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
      queue_entries: {
        Row: {
          id: string;
          clinic_id: string;
          patient_id: string;
          encounter_id: string | null;
          assigned_doctor_id: string | null;
          status: QueueStatus;
          arrival_type: QueueArrivalType;
          queue_number: number;
          sort_order: number;
          checked_in_at: string;
          checked_in_by: string | null;
          status_updated_at: string;
          notes: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["queue_entries"]["Row"],
          "id" | "created_at" | "updated_at" | "queue_number" | "sort_order" | "checked_in_at" | "status_updated_at"
        > & {
          queue_number?: number;
          sort_order?: number;
          checked_in_at?: string;
          status_updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["queue_entries"]["Insert"]>;
      };
    };
    Functions: {
      get_user_clinic_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      next_queue_number: {
        Args: { p_clinic_id: string };
        Returns: number;
      };
      consume_diagnose_quota: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
    };
  };
};

export type StaffRole = "admin" | "doctor" | "nurse" | "receptionist";
export type QueueStatus = "waiting" | "with_nurse" | "with_doctor" | "completed" | "cancelled";
export type QueueArrivalType = "walk_in" | "appointment";
export type EncounterStatus = "in_progress" | "completed" | "amended";
export type NoteSection = "chief_complaint" | "history" | "examination" | "diagnosis" | "general_notes";
export type DrugRoute = "oral" | "topical" | "injection" | "inhalation" | "sublingual" | "rectal" | "other";

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
