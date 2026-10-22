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
  mixed: '고급 주상복합',
  apartment: '아파트 / 공동주택',
  officetel: '오피스텔',
  industrial: '지식산업센터',
  retrofit: '기존 주차장 개선',
  investment: '투자 / 파트너십',
  government: '공공 / 지자체',
  other: '기타',
};

/** 알려진 유형은 한국어 라벨을, 알 수 없는 유형은 원래 값을 그대로 반환한다. */
export function getProjectTypeLabel(projectType: string): string {
  return Object.hasOwn(projectTypeLabels, projectType)
    ? projectTypeLabels[projectType]
    : projectType;
}
