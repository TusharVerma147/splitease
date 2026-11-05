import { ExportStatus } from '../../../../enum/enum';

export interface ExportRequestResult {
  exportId: string;
  status: ExportStatus;
}

export interface ExportStatusView {
  status: ExportStatus;
  /** 0-100 */
  progress: number;
  error?: string;
}
