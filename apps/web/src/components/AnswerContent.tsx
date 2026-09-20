import { Fragment } from "react";

// Render common answer formatting as React nodes; never inject model-generated HTML.
function Inline({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith("`") && part.endsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : <Fragment key={i}>{part}</Fragment>)}</>;
}
export function AnswerContent({ text }: { text: string }) {
  return <div className="answer-content">{text.split(/(```[\s\S]*?```)/g).map((section, i) => {
    if (section.startsWith("```")) return <pre key={i}><code>{section.replace(/^```[^\n]*\n?/, "").replace(/```$/, "").trim()}</code></pre>;
    return <Fragment key={i}>{section.split(/\n\s*\n/).filter(Boolean).map((block, j) => {
      const lines = block.trim().split("\n");
      if (lines.every(line => /^\s*([-*]|\d+[.)])\s/.test(line))) return <ul key={j}>{lines.map((line, k) => <li key={k}><Inline text={line.replace(/^\s*([-*]|\d+[.)])\s/, "")}/></li>)}</ul>;
      return <div className="answer-block" key={j}>{lines.map((line, k) => /^#{1,6}\s/.test(line) ? <h4 key={k}><Inline text={line.replace(/^#{1,6}\s/, "")}/></h4> : <Fragment key={k}><Inline text={line}/>{k < lines.length - 1 && <br/>}</Fragment>)}</div>;
    })}</Fragment>;
  })}</div>;
}
