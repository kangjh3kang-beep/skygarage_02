export type InquiryStatus = '접수대기' | '검토중' | '답변완료' | '보류';

export interface InquiryNote {
  id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface StatusHistoryEntry {
  from: InquiryStatus;
  to: InquiryStatus;
  changed_by: string;
  changed_at: string;
  note?: string;
}

export interface Inquiry {
  id: string;
  company: string;
  name: string;
  phone: string;
  email: string;
  project_type: string;
  message: string;
  status: InquiryStatus;
  admin_notes: InquiryNote[] | null;
  status_history: StatusHistoryEntry[] | null;
  reply_content: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}

export const projectTypeLabels: Record<string, string> = {
  website: '웹사이트',
  app: '앱 개발',
  ecommerce: '이커머스',
  branding: '브랜딩',
  consulting: '컨설팅',
  other: '기타',
};
