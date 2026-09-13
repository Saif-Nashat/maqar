import { useState, useEffect } from "react";
import { useApp } from "../store/AppContext.jsx";

export default function Modal() {
  const { modal, closeModal } = useApp();
  const [text, setText] = useState("");

  useEffect(() => { setText(""); }, [modal]);

  if (!modal) return null;
  const { title, msg, cancelTxt = "Cancel", okTxt = "Confirm", variant = "bad", textarea, onConfirm } = modal;
  const okColor = variant === "warn" ? "var(--warn)" : "var(--bad)";

  function confirm() {
    closeModal();
    onConfirm?.(text);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-[22px]"
      style={{ background: "rgba(28,18,13,.55)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="w-full max-w-[420px] p-6 rounded-r animate-modalIn"
        style={{ background: "var(--surface)", boxShadow: "0 4px 10px rgba(43,29,23,.12),0 30px 80px rgba(43,29,23,.35),0 1px 0 rgba(255,255,255,.7) inset" }}>
        <h3 className="text-[20px] font-semibold mb-[6px]">{title}</h3>
        <p className="text-[14px] mb-4" style={{ color: "var(--muted)" }}>{msg}</p>
        {textarea && (
          <textarea
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Room double-booked for maintenance"
            className="field-input mb-2 min-h-[90px] resize-y" />
        )}
        <div className="flex gap-[10px] mt-4">
          <button className="btn-soft flex-1 py-[11px] rounded-rs" onClick={closeModal}>{cancelTxt}</button>
          <button className="flex-1 py-[11px] rounded-rs font-bold text-white" style={{ background: okColor }} onClick={confirm}>
            {okTxt}
          </button>
        </div>
      </div>
    </div>
  );
}
