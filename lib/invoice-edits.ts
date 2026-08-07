export type LineItemEditableFields = {
  Item?: string | null;
  line_notes?: string | null;
  QTY?: string | null;
  CU_Price?: string | null;
  Amount?: string | null;
  Confidence?: string | null;
  GL_Account?: string;
};

export type LineUpdate = {
  id: number | string;
  fields: LineItemEditableFields;
};

export type HeaderUpdates = Partial<
  Record<
    "Merchant" | "Invoice_Number" | "Invoice_Date" | "Status" | "lounge_code",
    string | null
  >
>;

export type SaveInvoiceEditsInput = {
  projectId: string;
  filename: string;
  loungeCode: string | null;
  lineUpdates?: LineUpdate[];
  lineDeletes?: (number | string)[];
  headerUpdates?: HeaderUpdates;
};

export type RecomputedPeriod = {
  location: string;
  period_start: string;
  period_end: string;
};

export type SaveInvoiceEditsSummary = {
  fields_changed: number;
  deletes: number;
  headers_changed: number;
  audit_rows: number;
  recomputed: RecomputedPeriod[];
};
