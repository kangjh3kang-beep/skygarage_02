import { requestLabels } from "../request-labels";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSgpAuth } from "../contexts/SgpAuthContext";
import {
  useResidentData,
  type RequestCategory,
} from "../contexts/ResidentDataContext";
export default function ServiceRequestForm({
  category,
}: {
  category: RequestCategory;
}) {
  const { user } = useSgpAuth();
  const { reload } = useResidentData();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    setError("");
    setReceipt("");
    try {
      const { data, error: failure } = await supabase.rpc(
        "sgp_submit_service_request",
        {
          p_client_request_id: requestId,
          p_category: category,
          p_subject: subject.trim(),
          p_description: description.trim(),
        },
      );
      if (failure || !data) throw new Error("save failed");
      setReceipt(data);
      setRequestId(crypto.randomUUID());
      setSubject("");
      setDescription("");
      reload();
    } catch {
      setError(
        "접수 여부를 확인하지 못했습니다. 내 요청 내역을 확인한 뒤 다시 시도해 주세요. 짧은 시간에 여러 번 요청했다면 잠시 기다려 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="doelv-form" onSubmit={submit}>
      <h3>{requestLabels[category]}</h3>
      <p className="doelv-muted">
        담당자 확인 후 앱에서 답변을 확인할 수 있습니다. 접수만으로 출입·차량
        운행 권한이 부여되지는 않습니다.
      </p>
      <label>
        제목
        <input
          required
          minLength={2}
          maxLength={80}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={
            category === "residence" ? "연결할 단지·건물 이름" : "요청 제목"
          }
        />
      </label>
      <label>
        요청 내용
        <textarea
          required
          minLength={5}
          maxLength={2000}
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="확인에 필요한 내용을 적어 주세요. 비밀번호·주민등록번호는 입력하지 마세요."
        />
      </label>
      {error && (
        <p role="alert" className="doelv-error">
          {error}
        </p>
      )}
      {receipt && (
        <p role="status" className="doelv-success">
          서버에 접수되었습니다. 접수번호 {receipt.slice(0, 8)}
        </p>
      )}
      <button
        className="doelv-primary"
        type="submit"
        disabled={
          busy || subject.trim().length < 2 || description.trim().length < 5
        }
      >
        {busy ? "접수 중…" : "요청 접수하기"} <span>↗</span>
      </button>
    </form>
  );
}
