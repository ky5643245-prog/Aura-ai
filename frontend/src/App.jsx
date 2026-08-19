import { useCallback, useEffect, useRef, useState } from "react";

import {
  Settings,
  Sparkles,
  ChevronDown,
  X,
  AlertCircle,
  Crown,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { api, streamChat } from "./services/api";
import AuthScreen from "./components/AuthScreen";
import ChatMessage from "./components/ChatMessage";
import Composer from "./components/Composer";
import SettingsModal from "./components/SettingsModal";


/* ============================================================
   AURA AI — SUGGESTIONS
============================================================ */

const suggestions = [
  {
    icon: "✦",
    title: "Explain something",
    text: "Explain a difficult concept in simple terms with examples.",
  },
  {
    icon: "⌘",
    title: "Write code",
    text: "Build a clean, production-ready React component for my idea.",
  },
  {
    icon: "◈",
    title: "Analyze data",
    text: "Help me understand this dataset and identify important patterns.",
  },
  {
    icon: "✧",
    title: "Brainstorm ideas",
    text: "Give me 10 ambitious but practical ideas for a new digital product.",
  },
];


/* ============================================================
   APP
============================================================ */

export default function App() {

  /* ==========================================================
     AUTH
  ========================================================== */

  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);


  /* ==========================================================
     CHAT
  ========================================================== */

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);

  const [input, setInput] = useState("");


  /* ==========================================================
     AI STATE
  ========================================================== */

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("");


  /* ==========================================================
     UI STATE
  ========================================================== */

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({});
  const [model, setModel] = useState("");


  /* ==========================================================
     REFS
  ========================================================== */

  const abortRef = useRef(null);
  const scrollRef = useRef(null);


  /* ==========================================================
     AUTH CHECK
  ========================================================== */

  useEffect(() => {

    let mounted = true;

    async function checkAuth() {

      try {

        const result = await api("/api/auth/me");

        if (mounted) {
          setUser(result?.user || null);
        }

      } catch {

        if (mounted) {
          setUser(null);
        }

      } finally {

        if (mounted) {
          setAuthChecked(true);
        }

      }

    }

    checkAuth();

    return () => {
      mounted = false;
    };

  }, []);


  /* ==========================================================
     LOAD CONVERSATIONS
     
     NOTE:
     History UI is removed.
     Conversations are still loaded because the backend
     needs them for active chat state.
  ========================================================== */

  const refreshConversations = useCallback(async () => {

    try {

      const data = await api("/api/conversations");

      const list = Array.isArray(data?.conversations)
        ? data.conversations
        : [];

      setConversations(list);

      /*
       * If there is no active conversation, use the latest
       * existing conversation automatically.
       *
       * No History UI is shown.
       */

      setActiveId((currentId) => {

        if (currentId) {
          return currentId;
        }

        return list?.[0]?.id || null;

      });

    } catch (e) {

      setError(
        e?.message ||
        "Could not load conversations."
      );

    }

  }, []);


  /* ==========================================================
     LOAD SETTINGS
  ========================================================== */

  useEffect(() => {

    if (!user) {
      return;
    }

    refreshConversations();

    api("/api/settings")
      .then((result) => {

        const nextSettings =
          result?.settings || {};

        setSettings(nextSettings);

        setModel(
          nextSettings.model || ""
        );

      })
      .catch(() => {});

  }, [
    user,
    refreshConversations,
  ]);


  /* ==========================================================
     LOAD ACTIVE CONVERSATION
  ========================================================== */

  useEffect(() => {

    if (!activeId) {

      setMessages([]);

      return;
    }

    let cancelled = false;

    async function loadConversation() {

      try {

        const result = await api(
          `/api/conversations/${activeId}`
        );

        if (!cancelled) {

          setMessages(
            Array.isArray(result?.messages)
              ? result.messages
              : []
          );

        }

      } catch (e) {

        if (!cancelled) {

          setError(
            e?.message ||
            "Could not load conversation."
          );

        }

      }

    }

    loadConversation();

    return () => {
      cancelled = true;
    };

  }, [activeId]);


  /* ==========================================================
     AUTO SCROLL
  ========================================================== */

  useEffect(() => {

    const element = scrollRef.current;

    if (!element) {
      return;
    }

    requestAnimationFrame(() => {

      element.scrollTo({

        top: element.scrollHeight,

        behavior: generating
          ? "auto"
          : "smooth",

      });

    });

  }, [
    messages,
    generating,
  ]);


  /* ==========================================================
     GLOBAL EVENTS
     
     Voice input is kept.
     Clear-history event is removed because History UI
     is intentionally removed.
  ========================================================== */

  useEffect(() => {

    function voiceInput() {

      if (
        !(
          "webkitSpeechRecognition" in window
        ) &&
        !(
          "SpeechRecognition" in window
        )
      ) {

        setError(
          "Voice input is not supported in this browser."
        );

        return;
      }

      const Recognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

      const recognition =
        new Recognition();

      recognition.lang = "en-US";

      recognition.interimResults = false;

      recognition.continuous = false;

      recognition.onresult = (event) => {

        const transcript =
          event?.results?.[0]?.[0]
            ?.transcript || "";

        if (!transcript) {
          return;
        }

        setInput((current) => {

          const safeCurrent =
            typeof current === "string"
              ? current
              : "";

          return safeCurrent
            ? `${safeCurrent} ${transcript}`
            : transcript;

        });

      };

      recognition.onerror = () => {

        setError(
          "Voice input failed."
        );

      };

      try {

        recognition.start();

      } catch {

        setError(
          "Could not start voice input."
        );

      }

    }


    window.addEventListener(
      "aura-voice",
      voiceInput
    );


    return () => {

      window.removeEventListener(
        "aura-voice",
        voiceInput
      );

    };

  }, []);


  /* ==========================================================
     CREATE CONVERSATION
     
     This function is NOT exposed as a button.
     It is only used automatically when required.
  ========================================================== */

  async function createConversation() {

    const result = await api(
      "/api/conversations",
      {
        method: "POST",
      }
    );

    const conversation =
      result?.conversation;

    if (!conversation?.id) {

      throw new Error(
        "Server did not return a conversation."
      );

    }

    setConversations((current) => [

      conversation,

      ...current.filter(
        (item) =>
          item.id !== conversation.id
      ),

    ]);

    setActiveId(
      conversation.id
    );

    return conversation;
  }


  /* ==========================================================
     SEND MESSAGE
  ========================================================== */

  async function send(
    text = "",
    attachment = null
  ) {

    const safeText =
      typeof text === "string"
        ? text
        : text == null
        ? ""
        : String(text);

    const trimmedText =
      safeText.trim();

    if (generating) {
      return;
    }

    if (
      !trimmedText &&
      !attachment
    ) {
      return;
    }

    setError("");

    let conversationId =
      activeId;


    try {

      /* ------------------------------------------------------
         AUTO CREATE CHAT
      ------------------------------------------------------ */

      if (!conversationId) {

        const conversation =
          await createConversation();

        conversationId =
          conversation.id;

      }


      /* ------------------------------------------------------
         FILE ATTACHMENT
      ------------------------------------------------------ */

      let finalText =
        trimmedText;

      if (attachment?.file) {

        const form =
          new FormData();

        form.append(
          "file",
          attachment.file
        );

        const uploadResponse =
          await fetch(
            "/api/files",
            {
              method: "POST",
              credentials: "include",
              body: form,
            }
          );

        const contentType =
          uploadResponse.headers.get(
            "content-type"
          ) || "";

        const uploadBody =
          contentType.includes(
            "application/json"
          )
            ? await uploadResponse.json()
            : {};

        if (!uploadResponse.ok) {

          throw new Error(
            uploadBody?.error ||
            "File upload failed."
          );

        }

        const uploaded =
          uploadBody?.attachment;

        if (uploaded) {

          finalText +=
            `\n\n[Attached file: ${
              uploaded.name ||
              "file"
            }]`;

          if (uploaded.text) {

            finalText +=
              `\n\nFile content:\n${
                uploaded.text
              }`;

          }

        }

      }


      if (!finalText.trim()) {
        return;
      }


      /* ------------------------------------------------------
         TEMP USER MESSAGE
      ------------------------------------------------------ */

      const userMessage = {

        id:
          `temp-user-${Date.now()}`,

        role: "user",

        content:
          finalText,

        created_at:
          new Date().toISOString(),

      };


      /* ------------------------------------------------------
         TEMP ASSISTANT MESSAGE
      ------------------------------------------------------ */

      const assistantMessage = {

        id:
          `temp-assistant-${Date.now()}`,

        role: "assistant",

        content: "",

        created_at:
          new Date().toISOString(),

        streaming: true,

      };


      setMessages((current) => [

        ...current,

        userMessage,
        assistantMessage,

      ]);

      setInput("");

      setGenerating(true);


      /* ------------------------------------------------------
         ABORT CONTROLLER
      ------------------------------------------------------ */

      const controller =
        new AbortController();

      abortRef.current =
        controller;


      /* ------------------------------------------------------
         STREAM CHAT
      ------------------------------------------------------ */

      await streamChat(

        "/api/chat",

        {
          conversationId,

          content:
            finalText,

          model:
            model || undefined,
        },

        {

          signal:
            controller.signal,


          /* --------------------------------------------------
             META
          -------------------------------------------------- */

          onMeta: (meta) => {

            if (meta?.mode) {

              setMode(
                meta.mode
              );

            }

          },


          /* --------------------------------------------------
             DELTA
          -------------------------------------------------- */

          onDelta: (delta) => {

            const chunk =
              typeof delta?.text ===
              "string"
                ? delta.text
                : "";

            if (!chunk) {
              return;
            }

            setMessages((current) => {

              if (!current.length) {
                return current;
              }

              const next =
                [...current];

              const lastIndex =
                next.length - 1;

              const last =
                next[lastIndex];


              if (
                last?.role !==
                "assistant"
              ) {

                next.push({

                  id:
                    `temp-assistant-${Date.now()}`,

                  role:
                    "assistant",

                  content:
                    chunk,

                  streaming:
                    true,

                });

                return next;

              }


              next[lastIndex] = {

                ...last,

                content:
                  (
                    typeof last.content ===
                    "string"
                      ? last.content
                      : ""
                  ) + chunk,

                streaming:
                  true,

              };


              return next;

            });

          },


          /* --------------------------------------------------
             DONE
          -------------------------------------------------- */

          onDone: () => {

            setMessages((current) =>

              current.map(
                (message) => ({

                  ...message,

                  streaming:
                    false,

                })
              )

            );

          },


          /* --------------------------------------------------
             ERROR
          -------------------------------------------------- */

          onError: (streamError) => {

            const message =
              streamError?.error ||
              streamError?.message ||
              "AI request failed.";

            setError(message);

            setMessages((current) =>

              current.map(
                (item) =>

                  item.streaming
                    ? {

                        ...item,

                        streaming:
                          false,

                        error:
                          true,

                      }
                    : item

              )

            );

          },

        }

      );


      await refreshConversations();


    } catch (e) {

      if (
        e?.name !==
        "AbortError"
      ) {

        setError(
          e?.message ||
          "Something went wrong."
        );

        setMessages((current) =>

          current.map(
            (item) =>

              item.streaming
                ? {

                    ...item,

                    streaming:
                      false,

                    error:
                      true,

                  }
                : item

          )

        );

      }

    } finally {

      setGenerating(false);

      abortRef.current =
        null;

    }

  }


  /* ==========================================================
     STOP GENERATION
  ========================================================== */

  function stop() {

    abortRef.current?.abort();

    abortRef.current =
      null;

    setGenerating(false);

    setMessages((current) =>

      current.map(
        (message) =>

          message.streaming
            ? {

                ...message,

                streaming:
                  false,

              }
            : message

      )

    );

  }


  /* ==========================================================
     REGENERATE
  ========================================================== */

  async function regenerate() {

    if (
      !activeId ||
      generating
    ) {
      return;
    }

    setError("");

    setGenerating(true);

    setMessages((current) =>

      current.map(
        (message, index) =>

          index ===
            current.length - 1 &&
          message.role ===
            "assistant"

            ? {

                ...message,

                content: "",

                streaming:
                  true,

                error:
                  false,

              }

            : message

      )

    );


    const controller =
      new AbortController();

    abortRef.current =
      controller;


    try {

      await streamChat(

        "/api/chat/regenerate",

        {
          conversationId:
            activeId,
        },

        {

          signal:
            controller.signal,


          onMeta: (meta) => {

            if (meta?.mode) {

              setMode(
                meta.mode
              );

            }

          },


          onDelta: (delta) => {

            const chunk =
              typeof delta?.text ===
              "string"
                ? delta.text
                : "";

            if (!chunk) {
              return;
            }

            setMessages((current) => {

              const next =
                [...current];

              if (!next.length) {
                return next;
              }

              const lastIndex =
                next.length - 1;

              next[lastIndex] = {

                ...next[lastIndex],

                content:
                  (
                    typeof next[
                      lastIndex
                    ].content ===
                    "string"
                      ? next[
                          lastIndex
                        ].content
                      : ""
                  ) + chunk,

                streaming:
                  true,

              };

              return next;

            });

          },


          onDone: () => {

            setMessages((current) =>

              current.map(
                (message) => ({

                  ...message,

                  streaming:
                    false,

                })
              )

            );

          },


          onError: (streamError) => {

            setError(
              streamError?.error ||
              streamError?.message ||
              "Regeneration failed."
            );

          },

        }

      );


      await refreshConversations();


    } catch (e) {

      if (
        e?.name !==
        "AbortError"
      ) {

        setError(
          e?.message ||
          "Regeneration failed."
        );

      }

    } finally {

      setGenerating(false);

      abortRef.current =
        null;

    }

  }


  /* ==========================================================
     EDIT MESSAGE
  ========================================================== */

  async function editMessage(
    messageId,
    text
  ) {

    const safeText =
      typeof text === "string"
        ? text
        : text == null
        ? ""
        : String(text);

    const trimmedText =
      safeText.trim();

    if (
      !trimmedText ||
      generating ||
      !activeId
    ) {
      return;
    }


    const index =
      messages.findIndex(
        (message) =>
          message.id ===
          messageId
      );

    if (index < 0) {
      return;
    }


    setError("");


    setMessages(
      messages.slice(
        0,
        index
      )
    );


    setGenerating(true);


    const controller =
      new AbortController();

    abortRef.current =
      controller;


    try {

      await streamChat(

        "/api/chat/edit",

        {
          conversationId:
            activeId,

          messageId,

          content:
            trimmedText,
        },

        {

          signal:
            controller.signal,


          onMeta: (meta) => {

            if (meta?.mode) {

              setMode(
                meta.mode
              );

            }

          },


          onDelta: (delta) => {

            const chunk =
              typeof delta?.text ===
              "string"
                ? delta.text
                : "";

            if (!chunk) {
              return;
            }


            setMessages((current) => {

              const next =
                [...current];

              const last =
                next[
                  next.length - 1
                ];


              if (last?.streaming) {

                next[
                  next.length - 1
                ] = {

                  ...last,

                  content:
                    (
                      typeof last.content ===
                      "string"
                        ? last.content
                        : ""
                    ) + chunk,

                };

              } else {

                next.push({

                  id:
                    `temp-assistant-${Date.now()}`,

                  role:
                    "assistant",

                  content:
                    chunk,

                  streaming:
                    true,

                });

              }


              return next;

            });

          },


          onDone: () => {

            setMessages((current) =>

              current.map(
                (message) => ({

                  ...message,

                  streaming:
                    false,

                })
              )

            );

          },


          onError: (streamError) => {

            setError(
              streamError?.error ||
              streamError?.message ||
              "Edit failed."
            );

          },

        }

      );


      await refreshConversations();


    } catch (e) {

      if (
        e?.name !==
        "AbortError"
      ) {

        setError(
          e?.message ||
          "Edit failed."
        );

      }

    } finally {

      setGenerating(false);

      abortRef.current =
        null;

    }

  }


  /* ==========================================================
     SAVE SETTINGS
  ========================================================== */

  async function saveSettings(
    patch
  ) {

    try {

      const data =
        await api(
          "/api/settings",
          {
            method: "PATCH",

            body:
              JSON.stringify(
                patch
              ),

          }
        );


      const nextSettings =
        data?.settings || {};


      setSettings(
        nextSettings
      );


      if (
        patch.model !==
        undefined
      ) {

        setModel(
          patch.model || ""
        );

      }


    } catch (e) {

      setError(
        e?.message ||
        "Could not save settings."
      );

      throw e;

    }

  }


  /* ==========================================================
     LOGOUT
  ========================================================== */

  async function logout() {

    try {

      await api(
        "/api/auth/logout",
        {
          method: "POST",
        }
      );

    } catch {
      // Ignore logout errors.
    }


    abortRef.current?.abort();

    setUser(null);

    setMessages([]);

    setConversations([]);

    setActiveId(null);

    setSettings({});

    setSettingsOpen(false);

    setInput("");

    setGenerating(false);

  }


  /* ==========================================================
     LOADING SCREEN
  ========================================================== */

  if (!authChecked) {

    return (

      <div className="boot royal-boot">

        <div className="boot-orb">

          <Crown size={25} />

        </div>


        <div>

          <strong>
            AURA
          </strong>

          <span>
            Initializing intelligence...
          </span>

        </div>

      </div>

    );

  }


  /* ==========================================================
     AUTH
  ========================================================== */

  if (!user) {

    return (

      <AuthScreen
        onAuth={setUser}
      />

    );

  }


  /* ==========================================================
     ACTIVE CONVERSATION
     
     No History UI.
     No New Chat UI.
     Only current conversation title.
  ========================================================== */

  const active =
    conversations.find(
      (conversation) =>
        conversation.id ===
        activeId
    );


  /* ==========================================================
     AURA ROYAL UI
  ========================================================== */

  return (

    <div
      className={`
        app
        aura-royal
        ${settings?.theme === "light"
          ? "light"
          : ""}
        ${settings?.compact_mode
          ? "compact"
          : ""}
      `}
    >


      {/* ======================================================
         ROYAL BACKGROUND
      ====================================================== */}

      <div
        className="royal-background"
        aria-hidden="true"
      >

        <div
          className="
            royal-glow
            royal-glow-one
          "
        />

        <div
          className="
            royal-glow
            royal-glow-two
          "
        />

        <div
          className="royal-grid"
        />

        <div
          className="
            royal-vignette
          "
        />

      </div>


      {/* ======================================================
         CHAT SHELL
         
         IMPORTANT:
         NO SIDEBAR
         NO HISTORY
         NO NEW CHAT
      ====================================================== */}

      <main
        className="
          chat-shell
          royal-chat-shell
        "
      >


        {/* ====================================================
           TOPBAR
        ==================================================== */}

        <header
          className="
            topbar
            royal-topbar
          "
        >

          <div
            className="
              topbar-left
            "
          >


            {/* AURA BRAND */}

            <div
              className="
                aura-brand-mark
              "
            >

              <div
                className="
                  brand-crown
                "
              >

                <Crown
                  size={17}
                />

              </div>


              <div
                className="
                  brand-copy
                "
              >

                <strong>
                  AURA
                </strong>

                <span>
                  INTELLIGENCE
                </span>

              </div>

            </div>


            <div
              className="
                top-divider
              "
            />


            {/* CURRENT CHAT TITLE */}

            <div
              className="
                chat-title
                royal-chat-title
              "
            >

              <span>

                {active?.title ||
                  "New conversation"}

              </span>

              <ChevronDown
                size={14}
              />

            </div>

          </div>


          {/* TOP ACTIONS */}

          <div
            className="
              top-actions
            "
          >


            {/* AI MODE */}

            {mode && (

              <span
                className={`
                  mode-pill
                  royal-mode-pill
                  ${mode}
                `}
              >

                <span
                  className="
                    status-dot
                  "
                />

                {mode === "live"
                  ? "LIVE MODEL"
                  : "LOCAL AI"}

              </span>

            )}


            {/* MODEL */}

            {!mode && model && (

              <span
                className="
                  model-mini-pill
                "
              >

                <Zap
                  size={12}
                />

                {model}

              </span>

            )}


            {/* PRIVATE */}

            <div
              className="
                secure-badge
              "
            >

              <ShieldCheck
                size={13}
              />

              <span>
                PRIVATE
              </span>

            </div>


            {/* SETTINGS */}

            <button
              className="
                icon-btn
                royal-icon-btn
              "
              onClick={() =>
                setSettingsOpen(
                  true
                )
              }
              aria-label="
                Open settings
              "
              type="button"
            >

              <Settings
                size={18}
              />

            </button>

          </div>

        </header>


        {/* ====================================================
           MESSAGE AREA
        ==================================================== */}

        <section
          className="
            messages
            royal-messages
          "
          ref={scrollRef}
        >


          {/* ==================================================
             WELCOME
          ================================================== */}

          {!messages.length ? (

            <div
              className="
                welcome
                royal-welcome
              "
            >


              {/* HERO EMBLEM */}

              <div
                className="
                  welcome-emblem
                "
              >

                <div
                  className="
                    emblem-ring
                    ring-one
                  "
                />

                <div
                  className="
                    emblem-ring
                    ring-two
                  "
                />

                <div
                  className="
                    welcome-icon
                    royal-welcome-icon
                  "
                >

                  <Crown
                    size={30}
                  />

                </div>

              </div>


              {/* EYEBROW */}

              <div
                className="
                  royal-eyebrow
                "
              >

                <span />

                AURA AI

                <span />

              </div>


              {/* TITLE */}

              <h1>

                Intelligence,

                <br />

                <em>
                  refined.
                </em>

              </h1>


              {/* DESCRIPTION */}

              <p
                className="
                  royal-welcome-description
                "
              >

                Your private AI workspace
                for thinking, creating,
                coding and building
                extraordinary ideas.

              </p>


              {/* FEATURES */}

              <div
                className="
                  welcome-features
                "
              >

                <span>

                  <ShieldCheck
                    size={13}
                  />

                  Private

                </span>


                <span>

                  <Zap
                    size={13}
                  />

                  Fast

                </span>


                <span>

                  <Sparkles
                    size={13}
                  />

                  Intelligent

                </span>

              </div>


              {/* SUGGESTIONS */}

              <div
                className="
                  suggestions
                  royal-suggestions
                "
              >

                {suggestions.map(
                  ({
                    icon,
                    title,
                    text,
                  }) => (

                    <button
                      key={title}
                      type="button"
                      disabled={
                        generating
                      }
                      onClick={() =>
                        send(text)
                      }
                      className="
                        royal-suggestion
                      "
                    >

                      <span
                        className="
                          suggestion-icon
                        "
                      >
                        {icon}
                      </span>


                      <span
                        className="
                          suggestion-copy
                        "
                      >

                        <strong>
                          {title}
                        </strong>

                        <small>
                          {text}
                        </small>

                      </span>


                      <span
                        className="
                          suggestion-arrow
                        "
                      >
                        →
                      </span>

                    </button>

                  )
                )}

              </div>

            </div>

          ) : (


            /* =================================================
               CHAT MESSAGES
            ================================================= */

            <div
              className="
                message-stack
                royal-message-stack
              "
            >

              {messages.map(
                (
                  message,
                  index
                ) => (

                  <ChatMessage
                    key={
                      message.id ||
                      `message-${index}`
                    }
                    message={
                      message
                    }
                    streaming={
                      !!message.streaming
                    }
                    onRegenerate={
                      regenerate
                    }
                    onEdit={
                      editMessage
                    }
                  />

                )
              )}

            </div>

          )}


          {/* ==================================================
             ERROR
          ================================================== */}

          {error && (

            <div
              className="
                error-inline
                royal-error
              "
            >

              <div
                className="
                  error-icon
                "
              >

                <AlertCircle
                  size={17}
                />

              </div>


              <span>
                {error}
              </span>


              <button
                type="button"
                onClick={() =>
                  setError("")
                }
                aria-label="
                  Dismiss error
                "
              >

                <X
                  size={14}
                />

              </button>

            </div>

          )}

        </section>


        {/* ====================================================
           COMPOSER
        ==================================================== */}

        <div
          className="
            royal-composer-area
          "
        >

          <Composer

            value={
              typeof input ===
              "string"
                ? input
                : ""
            }

            onChange={(value) => {

              setInput(

                typeof value ===
                "string"

                  ? value

                  : value == null
                  ? ""

                  : String(value)

              );

            }}

            onSend={send}

            generating={
              generating
            }

            onStop={
              stop
            }

            model={
              model
            }

            onModelChange={
              setModel
            }

          />

        </div>


        {/* ====================================================
           FOOTER
        ==================================================== */}

        <footer
          className="
            footer-note
            royal-footer
          "
        >

          <span>

            <Sparkles
              size={11}
            />

            AURA AI

          </span>


          <i />


          <span>

            AI can make mistakes.
            Verify important
            information.

          </span>


          <i />


          <span>

            <ShieldCheck
              size={11}
            />

            Private workspace

          </span>

        </footer>

      </main>


      {/* ======================================================
         SETTINGS
      ====================================================== */}

      <SettingsModal

        open={
          settingsOpen
        }

        onClose={() =>
          setSettingsOpen(
            false
          )
        }

        settings={
          settings
        }

        onSave={
          saveSettings
        }

        onLogout={
          logout
        }

      />

    </div>

  );
}