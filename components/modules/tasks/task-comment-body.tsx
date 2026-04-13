"use client";

import * as React from "react";
import Link from "next/link";
import { parseCommentMentions } from "@/lib/task-comment-mentions";

export function TaskCommentBody({ body }: { body: string }) {
  const parts = parseCommentMentions(body);

  return (
    <span className="wrap-break-word whitespace-pre-wrap text-sm" dir="auto" lang="en">
      {parts.map((p, i) =>
        p.type === "text" ? (
          <React.Fragment key={i}>{p.value}</React.Fragment>
        ) : (
          <Link
            key={i}
            href={`/dashboard/team/${p.memberId}`}
            className="font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            @{p.name}
          </Link>
        )
      )}
    </span>
  );
}
