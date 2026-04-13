"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { buildMentionToken, matchActiveMentionQuery } from "@/lib/task-comment-mentions";

export type MentionTeamMember = { id: string; name: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  teamMembers: MentionTeamMember[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function TaskCommentInput({
  value,
  onChange,
  teamMembers,
  placeholder = "Write a comment…",
  className,
  disabled,
}: Props) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const [highlightIndex, setHighlightIndex] = React.useState(0);
  const [mention, setMention] = React.useState<{
    atIndex: number;
    query: string;
    caret: number;
  } | null>(null);

  const filtered = React.useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    const list = !q
      ? teamMembers
      : teamMembers.filter((m) => m.name.toLowerCase().includes(q));
    return list.slice(0, 25);
  }, [mention, teamMembers]);

  React.useEffect(() => {
    setHighlightIndex(0);
  }, [mention?.query, mention?.atIndex]);

  React.useEffect(() => {
    if (!mention || filtered.length === 0) return;
    const el = listRef.current?.querySelector(`[data-index="${highlightIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, mention, filtered.length]);

  const closeMention = React.useCallback(() => setMention(null), []);

  const applyMention = React.useCallback(
    (member: MentionTeamMember) => {
      if (!mention || !textareaRef.current) return;
      const ta = textareaRef.current;
      const token = buildMentionToken(member.name, member.id);
      const next =
        value.slice(0, mention.atIndex) + token + value.slice(mention.caret);
      onChange(next);
      closeMention();
      const pos = mention.atIndex + token.length;
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(pos, pos);
      });
    },
    [mention, value, onChange, closeMention]
  );

  const onChangeTextarea = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    const v = el.value;
    const pos = el.selectionStart ?? v.length;
    onChange(v);
    const before = v.slice(0, pos);
    const active = matchActiveMentionQuery(before);
    if (active) {
      setMention({ atIndex: active.atIndex, query: active.query, caret: pos });
    } else {
      closeMention();
    }
  };

  const onSelectTextarea = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const v = el.value;
    const pos = el.selectionStart ?? v.length;
    const before = v.slice(0, pos);
    const active = matchActiveMentionQuery(before);
    if (active) {
      setMention({ atIndex: active.atIndex, query: active.query, caret: pos });
    } else {
      closeMention();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mention || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const pick = filtered[highlightIndex];
      if (pick) applyMention(pick);
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const pick = filtered[highlightIndex];
      if (pick) applyMention(pick);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMention();
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={onChangeTextarea}
        onSelect={onSelectTextarea}
        onKeyDown={onKeyDown}
        onBlur={() => {
          window.setTimeout(() => closeMention(), 120);
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("min-h-[88px] resize-y", className)}
        dir="auto"
      />
      {mention && filtered.length > 0 ? (
        <ul
          ref={listRef}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-md border bg-popover py-1 text-popover-foreground shadow-md"
          role="listbox"
          lang="en"
        >
          {filtered.map((m, index) => (
            <li
              key={m.id}
              data-index={index}
              role="option"
              aria-selected={index === highlightIndex}
              className={cn(
                "cursor-pointer px-3 py-1.5 text-sm",
                index === highlightIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                applyMention(m);
              }}
              onMouseEnter={() => setHighlightIndex(index)}
            >
              {m.name}
            </li>
          ))}
        </ul>
      ) : null}
      {mention && teamMembers.length === 0 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
          No active team members to mention
        </div>
      ) : null}
      {mention && teamMembers.length > 0 && filtered.length === 0 ? (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md"
          lang="en"
        >
          No members found
        </div>
      ) : null}
    </div>
  );
}
