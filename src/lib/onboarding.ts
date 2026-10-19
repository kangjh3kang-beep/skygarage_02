export const onboardingAcceptance = [
  { id: 'G0-01', requirement: 'F01', title: '인증 앱 처음 등록', steps: ['본인 관리자 계정으로 로그인한다.', '인증 앱 등록하기에서 QR 또는 수동 키로 등록한다.', '기한 내 6자리 번호로 확인하고 관리 화면 진입을 확인한다.'], expected: '유효한 번호와 서버의 2단계 인증 확인 후에만 관리 화면이 열린다.' },
  { id: 'G0-02', requirement: 'F01', title: '잘못된 번호와 재로그인', steps: ['로그아웃 후 같은 계정으로 로그인한다.', '잘못된 번호를 입력해 접근이 거부되는지 확인한다.', '기존 인증 앱의 유효한 번호로 다시 인증한다.'], expected: '실패 시 화면이 열리지 않고 기존 인증 앱으로 재인증할 수 있다.' },
  { id: 'G0-03', requirement: 'F01', title: '계정 분리와 인증 정보 보호', steps: ['작성자와 검수자가 각자 본인 계정에서 인증한다.', '로그아웃·계정 변경 뒤 이전 QR·수동 키·업무 정보가 남지 않는지 확인한다.'], expected: '다른 계정의 인증 정보나 업무 데이터가 표시되지 않는다. 원자료에 QR·키·인증번호를 남기지 않는다.' },
  { id: 'G0-04', requirement: 'F06', title: '자기 승인 거부', steps: ['검증용 현장·버전에 실제 시험 증거를 작성자가 등록한다.', '같은 작성자로 승인과 과제 종료를 시도한다.', '다른 검수자가 원자료를 확인하고 의견을 남긴다.'], expected: '자기 승인은 서버에서 거부되고 별도 검수자의 결정이 기록된다.' },
  { id: 'G0-05', requirement: 'F01', title: '권한 회수 반영', steps: ['별도 시험 관리자에게 제한된 현장 권한을 부여한다.', '그 계정이 로그인한 상태에서 해당 권한을 회수한다.', '다시 조회와 변경 요청을 수행한다. 기존 데이터가 새 결과처럼 남지 않는지도 확인한다.'], expected: '회수된 권한으로 새로운 조회·변경을 할 수 없다. 최고관리자 전체 권한과 현장별 권한은 구분해 시험한다.' },
  { id: 'G0-06', requirement: 'F06', title: '실패와 만료 증거의 처리', steps: ['실패 시험을 등록하고 개선 과제에 연결한다.', '같은 종류·환경에서 수정 후 재시험한다.', '유효한 재시험을 다른 검수자가 확인한다. 만료 증거의 승격 거부도 확인한다.'], expected: '실패·만료·설정 불일치 증거가 운영 완료로 계산되지 않는다.' },
] as const;

export type OnboardingCase = typeof onboardingAcceptance[number];
export function findOnboardingCase(id: string | null): OnboardingCase | null {
  return onboardingAcceptance.find(c => c.id === id) ?? null;
}
export const onboardingProcedureVersion = (item: OnboardingCase) => `g0/${item.id}/v1`;
export const onboardingEvidencePath = (item: OnboardingCase) => `/admin/governance?case=${item.id}`;

export function parseDeploymentRelease(value: unknown): string {
  if (!value || typeof value !== 'object' || !('release' in value) || typeof value.release !== 'string' || !/^[a-f0-9]{40}$/.test(value.release)) throw new Error('release_unconfirmed');
  return value.release;
}
