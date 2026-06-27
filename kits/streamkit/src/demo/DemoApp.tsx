import { TopControlBar } from "../components/TopControlBar";
import DemoContent from "./components/DemoContent";
import "../components/control-bar.css";
import "./styles/demo-page.css";

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? "";

export default function DemoApp() {
  return (
    <>
      <TopControlBar mode="demo" signalingUrl={SIGNALING_URL || window.location.origin} />
      <DemoContent />
    </>
  );
}
