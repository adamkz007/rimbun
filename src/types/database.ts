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
          preferred_language: "en" | "ms";
          messaging_consent_at: string | null;
          archived_at: string | null;
          archived_reason: string | null;
          merged_into_patient_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["patients"]["Row"],
          "id" | "created_at" | "updated_at" | "preferred_language" | "messaging_consent_at"
        > & {
          preferred_language?: "en" | "ms";
          messaging_consent_at?: string | null;
        };
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
      screening_results: {
        Row: {
          id: string;
          clinic_id: string;
          patient_id: string | null;
          unmatched_name: string | null;
          unmatched_identifier: string | null;
          test_code: string;
          value_numeric: number | null;
          value_text: string | null;
          collected_on: string | null;
          reported_at: string;
          source: string | null;
          notes: string | null;
          suggested_urgency: CaseUrgency | null;
          triage_status: ResultTriageStatus;
          triaged_by: string | null;
          triaged_at: string | null;
          triage_note: string | null;
          entered_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["screening_results"]["Row"]> &
          Pick<Database["public"]["Tables"]["screening_results"]["Row"], "clinic_id" | "test_code">;
        Update: Partial<Database["public"]["Tables"]["screening_results"]["Row"]>;
      };
      result_cases: {
        Row: {
          id: string;
          clinic_id: string;
          patient_id: string;
          result_id: string;
          test_code: string;
          urgency: CaseUrgency;
          next_step: CaseNextStep;
          next_step_note: string | null;
          state: CaseStateValue;
          owner_staff_id: string;
          opened_by: string;
          opened_at: string;
          state_entered_at: string;
          current_step_due_at: string | null;
          appointment_at: string | null;
          surveillance_due_on: string | null;
          contact_attempts: number;
          reminders_sent: number;
          notified_at: string | null;
          acknowledged_at: string | null;
          understanding_correct: boolean | null;
          care_started_at: string | null;
          referral_rejected_at: string | null;
          closed_at: string | null;
          closed_by: string | null;
          closure_reason: CaseClosureReason | null;
          closure_note: string | null;
          reopened_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["result_cases"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["result_cases"]["Row"],
            "clinic_id" | "patient_id" | "result_id" | "test_code" | "urgency" | "next_step" | "owner_staff_id" | "opened_by"
          >;
        Update: Partial<Database["public"]["Tables"]["result_cases"]["Row"]>;
      };
      case_events: {
        Row: {
          id: string;
          clinic_id: string;
          case_id: string;
          event_type: string;
          from_state: CaseStateValue | null;
          to_state: CaseStateValue | null;
          actor_staff_id: string | null;
          actor_label: string | null;
          note: string | null;
          data: Record<string, unknown>;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["case_events"]["Row"]> &
          Pick<Database["public"]["Tables"]["case_events"]["Row"], "clinic_id" | "case_id" | "event_type">;
        Update: never;
      };
      patient_messages: {
        Row: {
          id: string;
          clinic_id: string;
          case_id: string;
          channel: "whatsapp" | "sms" | "call" | "in_person";
          kind: "result_notice" | "reminder" | "call_log";
          language: "en" | "ms";
          token_hash: string | null;
          expires_at: string | null;
          sent_by: string | null;
          sent_at: string;
          opened_at: string | null;
          verified_at: string | null;
          responded_at: string | null;
          response: "understood" | "question" | "call_me" | null;
          understanding_correct: boolean | null;
          call_outcome: "reached" | "no_answer" | "wrong_number" | null;
          note: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["patient_messages"]["Row"]> &
          Pick<Database["public"]["Tables"]["patient_messages"]["Row"], "clinic_id" | "case_id" | "channel" | "kind">;
        Update: Partial<Database["public"]["Tables"]["patient_messages"]["Row"]>;
      };
      referrals: {
        Row: {
          id: string;
          clinic_id: string;
          case_id: string;
          receiving_facility: string;
          receiving_clinician: string | null;
          specialty: string | null;
          letter: string;
          status: ReferralStatus;
          token_hash: string;
          expires_at: string;
          created_by: string;
          created_at: string;
          viewed_at: string | null;
          responded_at: string | null;
          reject_reason: string | null;
          appointment_on: string | null;
          outcome_note: string | null;
          attended_on: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["referrals"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["referrals"]["Row"],
            "clinic_id" | "case_id" | "receiving_facility" | "letter" | "token_hash" | "expires_at" | "created_by"
          >;
        Update: Partial<Database["public"]["Tables"]["referrals"]["Row"]>;
      };
      safety_net_followups: {
        Row: {
          id: string;
          clinic_id: string;
          patient_id: string;
          encounter_id: string;
          protocol_code: string;
          protocol_version: number;
          signs: string[];
          question_ids: string[];
          doctor_note: string | null;
          language: "en" | "ms";
          state: SafetyNetState;
          route: SafetyNetRoute | null;
          call_reason: SafetyNetCallReason | null;
          answers: Record<string, string>;
          owner_staff_id: string;
          created_by: string;
          checkin_due_at: string;
          current_step_due_at: string | null;
          sent_at: string | null;
          responded_at: string | null;
          completed_at: string | null;
          escalated_at: string | null;
          call_attempts: number;
          closed_at: string | null;
          closed_by: string | null;
          closure_reason: SafetyNetClosureReason | null;
          closure_note: string | null;
          ai_suggestion: Record<string, unknown> | null;
          sim_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["safety_net_followups"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["safety_net_followups"]["Row"],
            | "clinic_id"
            | "patient_id"
            | "encounter_id"
            | "protocol_code"
            | "protocol_version"
            | "owner_staff_id"
            | "created_by"
            | "checkin_due_at"
          >;
        Update: Partial<Database["public"]["Tables"]["safety_net_followups"]["Row"]>;
      };
      safety_net_messages: {
        Row: {
          id: string;
          clinic_id: string;
          followup_id: string;
          direction: "out" | "in";
          kind: "template" | "question" | "text" | "button_reply";
          body: string;
          question_id: string | null;
          options: Array<{ value: string; label: string }> | null;
          reply_value: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["safety_net_messages"]["Row"]> &
          Pick<Database["public"]["Tables"]["safety_net_messages"]["Row"], "clinic_id" | "followup_id" | "direction" | "kind" | "body">;
        Update: Partial<Database["public"]["Tables"]["safety_net_messages"]["Row"]>;
      };
      safety_net_events: {
        Row: {
          id: string;
          clinic_id: string;
          followup_id: string;
          event_type: string;
          actor_staff_id: string | null;
          actor_label: string | null;
          note: string | null;
          data: Record<string, unknown>;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["safety_net_events"]["Row"]> &
          Pick<Database["public"]["Tables"]["safety_net_events"]["Row"], "clinic_id" | "followup_id" | "event_type">;
        Update: Partial<Database["public"]["Tables"]["safety_net_events"]["Row"]>;
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
export type CaseUrgency = "routine" | "soon" | "urgent" | "critical";
export type ResultTriageStatus = "pending" | "normal" | "actionable";
export type CaseNextStep = "clinic_review" | "repeat_test" | "referral" | "same_day_review";
export type CaseStateValue =
  | "triaged"
  | "notified"
  | "acknowledged"
  | "confirmed"
  | "referred"
  | "accepted"
  | "attended"
  | "in_care"
  | "closed";
export type CaseClosureReason =
  | "completed"
  | "resolved_on_repeat"
  | "care_elsewhere"
  | "declined"
  | "lost_to_follow_up"
  | "deceased";
export type ReferralStatus = "sent" | "viewed" | "accepted" | "rejected" | "booked" | "attended";
export type SafetyNetState = "scheduled" | "awaiting_reply" | "answering" | "needs_call" | "escalated" | "closed";
export type SafetyNetRoute = "green" | "amber" | "red";
export type SafetyNetCallReason = "amber" | "no_reply" | "incomplete" | "patient_message";
export type SafetyNetClosureReason =
  | "improved"
  | "review_booked"
  | "blood_test"
  | "sent_to_emergency"
  | "unreachable"
  | "cancelled";
export type DrugRoute = "oral" | "topical" | "injection" | "inhalation" | "sublingual" | "rectal" | "other";

export type ClinicSettings = {
  modules?: {
    clerking?: boolean;
    queue?: boolean;
    billing?: boolean;
    dispensary?: boolean;
    attendance?: boolean;
    loop?: boolean;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
