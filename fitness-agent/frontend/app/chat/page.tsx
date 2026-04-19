"use client";

import type { AgentMessage } from "@/lib/types";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createThread, postMessage } from "@/lib/api";

const initialMessages: AgentMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content: "可以直接问训练、恢复、饮食，或者让我帮你调整当前计划。这里的回复会实时依赖后端和 Agent 服务。"
  }
];

const quickPrompts = [
  "如果我昨晚没睡好，而且腿很酸，今晚还适合训练吗？",
  "帮我把当前计划调整成低能量周版本。",
  "膝盖有点不舒服的话，Goblet Squat 可以换成什么动作？"
];

export default function ChatPage() {
  const [threadId, setThreadId] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("正在连接助手");

  const mountedRef = useRef(true);
  const threadPromiseRef = useRef<Promise<string> | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const ensureThread = useCallback(async (): Promise<string> => {
    if (threadId) {
      return threadId;
    }

    if (!threadPromiseRef.current) {
      threadPromiseRef.current = createThread()
        .then((result) => {
          if (mountedRef.current) {
            setThreadId(result.threadId);
            setStatus("助手已连接");
          }

          return result.threadId;
        })
        .catch((error) => {
          if (mountedRef.current) {
            const message = error instanceof Error ? error.message : "无法创建对话线程";
            setStatus(message);
          }

          throw error;
        })
        .finally(() => {
          threadPromiseRef.current = null;
        });
    }

    return threadPromiseRef.current;
  }, [threadId]);

  useEffect(() => {
    void ensureThread();
  }, [ensureThread]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      scrollAnchorRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, busy]);

  async function onSubmit() {
    if (!text.trim() || busy) {
      return;
    }

    const content = text.trim();
    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content
    };

    setMessages((current) => [...current, userMessage]);
    setText("");
    setBusy(true);
    setStatus("正在发送");

    try {
      const activeThreadId = await ensureThread();
      const response = await postMessage(activeThreadId, content);

      setMessages((current) => [
        ...current,
        {
          id: response.id,
          role: "assistant",
          content: response.content,
          reasoningSummary: response.reasoningSummary
        }
      ]);
      setStatus("已就绪");
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `请求失败：${message}`,
          reasoningSummary: "这里不再返回静态演示内容，报错反映的是当前后端或 Agent 的真实状态。"
        }
      ]);
      setStatus("请求失败");
    } finally {
      if (mountedRef.current) {
        setBusy(false);
      }
    }
  }

  return (
    <div className="page chat-page">
      <section className="chat-surface">
        <div className="chat-meta-row">
          <span className="section-label">Agent</span>
          <div className="chip-row">
            <span className={`status-pill ${busy ? "live" : "idle"}`}>{status}</span>
            <span className="mini-chip">{threadId ? "已连接" : "尚未建立线程"}</span>
          </div>
        </div>

        <div className="messages chat-feed">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message-row ${message.role === "user" ? "user" : "assistant"}`}
            >
              {message.role === "assistant" ? (
                <>
                  <div className="message-avatar assistant">
                    <Image
                      src="/brand/gympal-logo.jpg"
                      alt="GymPal"
                      width={36}
                      height={36}
                      className="message-avatar-image"
                    />
                  </div>

                  <div className="message-bubble assistant">
                    <small>GymPal</small>
                    <div>{message.content}</div>
                    {message.reasoningSummary ? (
                      <p className="muted message-meta">{message.reasoningSummary}</p>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="message-bubble user">
                    <small>你</small>
                    <div>{message.content}</div>
                    {message.reasoningSummary ? (
                      <p className="muted message-meta">{message.reasoningSummary}</p>
                    ) : null}
                  </div>

                  <div className="message-avatar user">
                    <span>U</span>
                  </div>
                </>
              )}
            </div>
          ))}
          <div ref={scrollAnchorRef} />
        </div>

        <div className="composer chat-composer">
          <textarea
            rows={4}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void onSubmit();
              }
            }}
            placeholder="可以询问训练安排、恢复建议、饮食调整或动作替代。按 Ctrl/Cmd + Enter 发送。"
          />

          <div className="chat-composer-row">
            <div className="chip-row">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="chip-button"
                  onClick={() => setText(prompt)}
                  disabled={busy}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="action-row">
              <button type="button" className="ghost-button" onClick={() => setText("")} disabled={busy}>
                清空
              </button>
              <button type="button" className="button" onClick={onSubmit} disabled={busy}>
                {busy ? "发送中..." : "发送"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
