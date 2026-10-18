import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
export default function PwaInstallPrompt() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [guide, setGuide] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const check = () =>
      setInstalled(
        media.matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone ===
            true,
      );
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const complete = () => {
      setInstalled(true);
      setPrompt(null);
    };
    check();
    media.addEventListener("change", check);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    return () => {
      media.removeEventListener("change", check);
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);
  async function install() {
    if (!prompt) {
      setGuide(true);
      return;
    }
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      setGuide(true);
    } finally {
      setPrompt(null);
    }
  }
  if (installed)
    return <span className="doelv-installed">홈 화면 앱으로 이용 중</span>;
  return (
    <>
      <button type="button" className="doelv-install" onClick={install}>
        ＋ 스마트폰 홈 화면에 설치
      </button>
      <Dialog
        open={guide}
        onClose={() => setGuide(false)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="install-title"
      >
        <DialogTitle id="install-title">DOELV 앱 설치 안내</DialogTitle>
        <DialogContent>
          <p>
            <strong>iPhone / iPad</strong>
            <br />
            Safari에서 이 페이지를 열고 공유 → 홈 화면에 추가 → 추가를
            선택하세요.
          </p>
          <p>
            <strong>Android</strong>
            <br />
            Chrome 또는 Samsung Internet 메뉴에서 앱 설치 또는 홈 화면에 추가를
            선택하세요.
          </p>
          <p>
            <strong>PC</strong>
            <br />
            Chrome·Edge 주소창의 설치 아이콘 또는 브라우저 메뉴를 이용하세요.
          </p>
          <p>
            설치 메뉴가 보이지 않으면 외부 브라우저에서 열어 주세요. 설치 후
            로그인·요청 전송에는 인터넷 연결이 필요합니다.
          </p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGuide(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
