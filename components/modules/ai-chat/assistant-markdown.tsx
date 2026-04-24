"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

import { cn } from "@/lib/utils";

const components: Components = {
  h1: ({ children, ...props }) => (
    <h1
      className="mt-4 mb-2 text-base font-semibold tracking-tight text-foreground first:mt-0"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="mt-3 mb-1.5 text-sm font-semibold tracking-tight text-foreground first:mt-0"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mt-3 mb-1 text-sm font-semibold text-foreground first:mt-0" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-2 text-sm leading-relaxed text-foreground last:mb-0" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mb-2 list-disc space-y-1 ps-5 text-sm leading-relaxed last:mb-0" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mb-2 list-decimal space-y-1 ps-5 text-sm leading-relaxed last:mb-0" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-relaxed [&>p]:mb-0" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-foreground" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic" {...props}>
      {children}
    </em>
  ),
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      className="text-primary font-medium underline underline-offset-2 hover:opacity-90"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const isFenced = typeof className === "string" && /language-[\w-]+/.test(className);
    return (
      <code
        className={cn(
          isFenced
            ? "block w-full bg-transparent p-0 font-mono text-xs leading-relaxed text-foreground"
            : "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground",
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }) => (
    <pre
      className="mb-2 max-h-[min(24rem,50vh)] overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-xs leading-relaxed last:mb-0 [&>code]:bg-transparent [&>code]:p-0"
      {...props}
    >
      {children}
    </pre>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="border-muted-foreground/35 text-muted-foreground mb-2 border-s-2 ps-3 text-sm italic last:mb-0"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: (props) => <hr className="my-4 border-border" {...props} />,
  table: ({ children, ...props }) => (
    <div className="mb-2 max-w-full overflow-x-auto last:mb-0">
      <table className="w-full min-w-48 border-collapse border border-border text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => <thead className="bg-muted/60" {...props}>{children}</thead>,
  th: ({ children, ...props }) => (
    <th
      className="border border-border px-2 py-1.5 text-start text-xs font-semibold text-foreground"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-border px-2 py-1.5 align-top text-xs leading-relaxed" {...props}>
      {children}
    </td>
  ),
  tr: ({ children, ...props }) => <tr {...props}>{children}</tr>,
  tbody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
};

export function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="assistant-markdown wrap-break-word">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
