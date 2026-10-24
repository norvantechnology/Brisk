export type ImportMode = 'skip' | 'upsert';

export interface RowError {
  row: number;
  identifier?: string;
  field?: string;
  message: string;
}

export interface SkippedRow {
  row: number;
  identifier: string;
  reason: string;
}

export interface ImportResult<T = unknown> {
  summary: {
    totalRows: number;
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
    failedCount: number;
  };
  imported: T[];
  updated: T[];
  skipped: SkippedRow[];
  errors: RowError[];
}
