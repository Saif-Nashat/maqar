import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Send, MessageCircle, Building2 } from "lucide-react";
import { roomText } from "../data/rooms.js";
import { useApp } from "../store/AppContext.jsx";
import { useT } from "../i18n/index.jsx";

export default function Messages() {
  const { roomId } = useParams();
  const nav = useNavigate();
  const { loggedIn, accountType, authReady, threads, getThread, sendMessage, toast, getRoom } = useApp();
  const { t, lang } = useT();

  useEffect(() => {
    if (authReady && !loggedIn) { toast(t("guard.signInFirst")); nav("/login", { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, authReady]);
  if (!authReady || !loggedIn) return null;

  if (roomId) return <Thread roomId={roomId} accountType={accountType} getThread={getThread} sendMessage={sendMessage} getRoom={getRoom} t={t} lang={lang} nav={nav} />;

  // conversation list
  const entries = Object.entries(threads);
  return (
    <div className="max-w-[760px] mx-auto px-[22px] pt-7 pb-[60px]">
      <h1 className="text-[30px] font-semibold tracking-[-.5px] title-rule mb-5">{t("msg.title")}</h1>
      {entries.length === 0 ? (
        <div className="surface p-10 text-center text-[14px]" style={{ color: "var(--muted)" }}>
          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" /> {t("msg.none")}
        </div>
      ) : (
        <div className="surface overflow-hidden">
          {entries.map(([rid, msgs], i) => {
            const room = getRoom(rid);
            const rt = room ? roomText(room, lang) : { title: `#${rid}` };
            const last = msgs[msgs.length - 1];
            return (
              <button key={rid} onClick={() => nav(`/messages/${rid}`)}
                className="w-full flex items-center gap-3 p-4 text-start transition-colors hover:bg-foam"
                style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
                <img src={room?.imgs?.[0]} alt="" className="w-[52px] h-[52px] rounded-[12px] object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-sans text-[15px] font-bold truncate">{rt.title}</div>
                  <div className="text-[13px] truncate" style={{ color: "var(--muted)" }}>
                    {last ? `${last.from === accountType ? t("msg.you") : t("msg.host")}: ${last.text}` : ""}
                  </div>
                </div>
                {last && <span className="text-[11px] shrink-0" style={{ color: "var(--muted)" }}>{last.ts}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Thread({ roomId, accountType, getThread, sendMessage, getRoom, t, lang, nav }) {
  const room = getRoom(roomId);
  const rt = room ? roomText(room, lang) : { title: `#${roomId}` };
  const msgs = getThread(roomId);
  const [text, setText] = useState("");
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  function send() {
    const v = text.trim();
    if (!v) return;
    sendMessage(roomId, accountType, v);
    setText("");
  }

  return (
    <div className="max-w-[760px] mx-auto px-[22px] pt-7 pb-[60px]">
      <button onClick={() => nav("/messages")} className="inline-flex items-center gap-[6px] font-semibold text-[14px] my-[10px] px-[13px] py-[7px] rounded-full hover:bg-foam transition-colors" style={{ color: "var(--coffee)" }}>
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" /> {t("msg.title")}
      </button>

      <div className="surface flex flex-col" style={{ height: "min(70vh, 560px)" }}>
        <div className="flex items-center gap-3 p-4" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="w-[40px] h-[40px] rounded-[11px] grid place-items-center shrink-0" style={{ background: "var(--fill-dark)", color: "var(--cream)" }}>
            <Building2 className="w-[18px] h-[18px]" />
          </div>
          <div>
            <div className="font-sans text-[15px] font-bold leading-tight">{rt.title}</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>{t("msg.threadWith", { room: rt.loc || "" })}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {msgs.length === 0 && <div className="text-center text-[13px] my-auto" style={{ color: "var(--muted)" }}>{t("msg.empty")}</div>}
          {msgs.map((m, i) => {
            const mine = m.from === accountType;
            return (
              <div key={i} className={`max-w-[78%] ${mine ? "self-end" : "self-start"}`}>
                <div className="px-[13px] py-[9px] rounded-[14px] text-[14px] leading-[1.4]"
                  style={mine
                    ? { background: "linear-gradient(150deg,var(--fill-dark),var(--fill-mid))", color: "var(--cream)", borderBottomRightRadius: 4 }
                    : { background: "var(--foam)", color: "var(--ink)", border: "1px solid var(--line)", borderBottomLeftRadius: 4 }}>
                  {m.text}
                </div>
                <div className={`text-[10px] mt-[2px] ${mine ? "text-end" : ""}`} style={{ color: "var(--muted)" }}>{m.ts}</div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div className="p-3 flex gap-2" style={{ borderTop: "1px solid var(--line)" }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={t("msg.placeholder")} className="field-input flex-1" />
          <button onClick={send} className="btn-primary px-[18px] rounded-xl flex items-center gap-2 text-[14px]">
            <Send className="w-4 h-4 rtl:rotate-180" /> {t("msg.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
