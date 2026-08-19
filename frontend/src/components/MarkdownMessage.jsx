import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

function CodeBlock({ inline, className, children }) {
  const [copied, setCopied] = useState(false);
  const language = /language-(\w+)/.exec(className || "")?.[1];
  const code = String(children).replace(/\n$/, "");

  if (inline) return <code className="inline-code">{children}</code>;

  return (
    <div className="code-wrap">
      <div className="code-head">
        <span>{language || "code"}</span>
        <button aria-label="Copy code" onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}>
          {copied ? <Check size={14}/> : <Copy size={14}/>}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter language={language || "text"} PreTag="div" className="code-block">
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export default function MarkdownMessage({ content }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
