export const TEMPLATE_VERSION = "residence-foundation/1.0.0";
export type SiteKind = "apartment" | "officetel" | "mixed";
export interface SiteTemplateInput {
  name: string;
  kind: SiteKind;
  households: number;
  parkingSpaces: number;
}
export function validateSiteTemplate(input: SiteTemplateInput): string[] {
  const errors: string[] = [];
  if (input.name.trim().length < 2 || input.name.trim().length > 120)
    errors.push("단지명은 2~120자로 입력해 주세요.");
  if (!["apartment", "officetel", "mixed"].includes(input.kind))
    errors.push("지원하는 단지 유형을 선택해 주세요.");
  if (
    !Number.isInteger(input.households) ||
    input.households < 1 ||
    input.households > 10000
  )
    errors.push("세대 수는 1~10,000의 정수여야 합니다.");
  if (
    !Number.isInteger(input.parkingSpaces) ||
    input.parkingSpaces < 0 ||
    input.parkingSpaces > 20000
  )
    errors.push("주차면 수는 0~20,000의 정수여야 합니다.");
  return errors;
}
export function previewSiteTemplate(input: SiteTemplateInput) {
  const errors = validateSiteTemplate(input);
  if (errors.length) throw new Error(errors.join(" "));
  return {
    schema_version: 1,
    template_version: TEMPLATE_VERSION,
    name: input.name.trim(),
    kind: input.kind,
    capacity: {
      households: input.households,
      parking_spaces: input.parkingSpaces,
    },
    brand: "DOELV",
    phase: "sandbox",
    membership_approval: "manual",
    hardware_control_enabled: false,
    payments_enabled: false,
    access_grants_enabled: false,
    modules: ["resident_profile", "service_requests"],
    required_gates: [
      "tenant_isolation",
      "scoped_roles",
      "membership_approval",
      "device_contract",
      "site_acceptance",
      "recovery_drill",
    ],
  };
}
