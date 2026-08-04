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
      fee_catalog: {
        Row: {
          id: string;
          clinic_id: string;
          code: string;
          description: string;
          category: FeeCategory;
          unit_amount: number;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["fee_catalog"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["fee_catalog"]["Insert"]>;
      };
      invoices: {
        Row: {
          id: string;
          clinic_id: string;
          patient_id: string;
          encounter_id: string | null;
          invoice_number: number;
          status: InvoiceStatus;
          subtotal: number;
          total: number;
          amount_paid: number;
          currency: string;
          notes: string | null;
          issued_at: string | null;
          issued_by: string | null;
          voided_at: string | null;
          voided_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["invoices"]["Row"],
          "id" | "created_at" | "updated_at" | "subtotal" | "total" | "amount_paid"
        > & {
          subtotal?: number;
          total?: number;
          amount_paid?: number;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
      };
      invoice_line_items: {
        Row: {
          id: string;
          invoice_id: string;
          source_type: InvoiceLineSourceType;
          source_id: string | null;
          description: string;
          quantity: number;
          unit_amount: number;
          line_total: number;
          sort_order: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["invoice_line_items"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["invoice_line_items"]["Insert"]>;
      };
      invoice_payments: {
        Row: {
          id: string;
          invoice_id: string;
          payment_method: PaymentMethod;
          amount: number;
          reference: string | null;
          notes: string | null;
          recorded_at: string;
          recorded_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["invoice_payments"]["Row"], "id" | "recorded_at"> & {
          recorded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoice_payments"]["Insert"]>;
      };
      inventory_items: {
        Row: {
          id: string;
          clinic_id: string;
          drug_id: string | null;
          name: string;
          sku: string | null;
          formulation: string | null;
          strength: string | null;
          unit: string;
          quantity_on_hand: number;
          reorder_level: number;
          is_controlled: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["inventory_items"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["inventory_items"]["Insert"]>;
      };
      dispensary_fulfillments: {
        Row: {
          id: string;
          clinic_id: string;
          encounter_id: string;
          encounter_prescription_id: string;
          patient_id: string;
          inventory_item_id: string | null;
          status: FulfillmentStatus;
          drug_name: string;
          dosage: string;
          quantity_requested: number;
          quantity_dispensed: number | null;
          is_controlled: boolean;
          controlled_verified_by: string | null;
          dispensed_at: string | null;
          dispensed_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["dispensary_fulfillments"]["Row"],
          "id" | "created_at" | "updated_at" | "quantity_dispensed" | "controlled_verified_by" | "dispensed_at" | "dispensed_by" | "notes"
        > & {
          quantity_dispensed?: number | null;
          controlled_verified_by?: string | null;
          dispensed_at?: string | null;
          dispensed_by?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["dispensary_fulfillments"]["Insert"]>;
      };
      stock_movements: {
        Row: {
          id: string;
          clinic_id: string;
          inventory_item_id: string;
          movement_type: StockMovementType;
          quantity_change: number;
          quantity_after: number;
          reference_type: "fulfillment" | "manual" | null;
          reference_id: string | null;
          reason: string | null;
          recorded_by: string | null;
          recorded_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["stock_movements"]["Row"], "id" | "recorded_at"> & {
          recorded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stock_movements"]["Insert"]>;
      };
      enquiries: {
        Row: {
          id: string;
          clinic_id: string;
          source: EnquirySource;
          status: EnquiryStatus;
          contact_name: string;
          contact_phone: string | null;
          contact_email: string | null;
          subject: string | null;
          notes: string | null;
          patient_id: string | null;
          converted_patient_id: string | null;
          scheduled_at: string | null;
          assigned_to: string | null;
          recorded_by: string | null;
          converted_at: string | null;
          converted_by: string | null;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["enquiries"]["Row"],
          | "id"
          | "created_at"
          | "updated_at"
          | "status"
          | "patient_id"
          | "converted_patient_id"
          | "scheduled_at"
          | "assigned_to"
          | "recorded_by"
          | "converted_at"
          | "converted_by"
          | "closed_at"
          | "closed_by"
        > & {
          status?: EnquiryStatus;
          patient_id?: string | null;
          converted_patient_id?: string | null;
          scheduled_at?: string | null;
          assigned_to?: string | null;
          recorded_by?: string | null;
          converted_at?: string | null;
          converted_by?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["enquiries"]["Insert"]>;
      };
      enquiry_reminders: {
        Row: {
          id: string;
          clinic_id: string;
          enquiry_id: string;
          reminder_type: ReminderType;
          status: ReminderStatus;
          notification_channel: NotificationChannel;
          remind_at: string;
          message: string | null;
          sent_at: string | null;
          dismissed_at: string | null;
          dismissed_by: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["enquiry_reminders"]["Row"],
          | "id"
          | "created_at"
          | "updated_at"
          | "status"
          | "notification_channel"
          | "message"
          | "sent_at"
          | "dismissed_at"
          | "dismissed_by"
          | "created_by"
        > & {
          status?: ReminderStatus;
          notification_channel?: NotificationChannel;
          message?: string | null;
          sent_at?: string | null;
          dismissed_at?: string | null;
          dismissed_by?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["enquiry_reminders"]["Insert"]>;
      };
      staff_shifts: {
        Row: {
          id: string;
          clinic_id: string;
          staff_id: string;
          shift_date: string;
          start_time: string;
          end_time: string;
          status: ShiftStatus;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["staff_shifts"]["Row"],
          "id" | "created_at" | "updated_at" | "status" | "notes" | "created_by"
        > & {
          status?: ShiftStatus;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["staff_shifts"]["Insert"]>;
      };
      attendance_records: {
        Row: {
          id: string;
          clinic_id: string;
          staff_id: string;
          shift_id: string | null;
          clock_in_at: string;
          clock_out_at: string | null;
          status: AttendanceStatus;
          notes: string | null;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["attendance_records"]["Row"],
          | "id"
          | "created_at"
          | "updated_at"
          | "shift_id"
          | "clock_out_at"
          | "status"
          | "notes"
          | "recorded_by"
        > & {
          shift_id?: string | null;
          clock_out_at?: string | null;
          status?: AttendanceStatus;
          notes?: string | null;
          recorded_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["attendance_records"]["Insert"]>;
      };
      leave_requests: {
        Row: {
          id: string;
          clinic_id: string;
          staff_id: string;
          leave_type: LeaveType;
          status: LeaveStatus;
          start_date: string;
          end_date: string;
          reason: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["leave_requests"]["Row"],
          | "id"
          | "created_at"
          | "updated_at"
          | "status"
          | "reason"
          | "reviewed_by"
          | "reviewed_at"
        > & {
          status?: LeaveStatus;
          reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["leave_requests"]["Insert"]>;
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
      next_invoice_number: {
        Args: { p_clinic_id: string };
        Returns: number;
      };
    };
  };
};

export type StaffRole = "admin" | "doctor" | "nurse" | "receptionist";
export type QueueStatus = "waiting" | "with_nurse" | "with_doctor" | "completed" | "cancelled";
export type QueueArrivalType = "walk_in" | "appointment";
export type InvoiceStatus = "draft" | "issued" | "paid" | "partial" | "void";
export type InvoiceLineSourceType = "consultation" | "prescription" | "fee_catalog" | "manual";
export type PaymentMethod = "cash" | "card" | "bank_transfer" | "ewallet" | "other";
export type FeeCategory = "consultation" | "procedure" | "medication" | "other";
export type FulfillmentStatus = "pending" | "dispensed" | "cancelled";
export type StockMovementType = "receipt" | "dispense" | "adjustment" | "return";
export type EnquirySource = "call" | "walk_in" | "follow_up" | "appointment";
export type EnquiryStatus = "new" | "in_progress" | "scheduled" | "converted" | "closed" | "cancelled";
export type ReminderType = "follow_up" | "appointment" | "callback";
export type ReminderStatus = "pending" | "sent" | "dismissed" | "failed";
export type NotificationChannel = "in_app" | "email" | "sms";
export type ShiftStatus = "scheduled" | "cancelled";
export type AttendanceStatus = "clocked_in" | "clocked_out" | "missed" | "adjusted";
export type LeaveType = "annual" | "sick" | "unpaid" | "emergency";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type EncounterStatus = "in_progress" | "completed" | "amended";
export type NoteSection = "chief_complaint" | "history" | "examination" | "diagnosis" | "general_notes";
export type DrugRoute = "oral" | "topical" | "injection" | "inhalation" | "sublingual" | "rectal" | "other";

export type ClinicSettings = {
  modules?: {
    clerking?: boolean;
    queue?: boolean;
    billing?: boolean;
    dispensary?: boolean;
    enquiry?: boolean;
    attendance?: boolean;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
