import { useApp } from "../store/AppContext.jsx";

export default function Toast() {
  const { toastMsg, toastShown } = useApp();
  return (
    <div
      className="fixed bottom-6 left-1/2 z-[200] px-[22px] py-[13px] rounded-xl text-[14px] font-semibold pointer-events-none transition duration-300"
      style={{
        color: "var(--cream)",
        background: "linear-gradient(150deg,rgba(51,35,27,.96),rgba(36,24,18,.96))",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(201,162,126,.3)",
        boxShadow: "0 12px 40px rgba(43,29,23,.35)",
        opacity: toastShown ? 1 : 0,
        transform: `translateX(-50%) translateY(${toastShown ? 0 : 20}px)`,
      }}>
      {toastMsg}
    </div>
  );
}
