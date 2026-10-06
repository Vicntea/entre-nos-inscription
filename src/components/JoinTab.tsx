"use client";

import { useState } from "react";
import JoinDialog from "./JoinDialog";

export default function JoinTab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="join-tab"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-controls="join-dialog"
        aria-expanded={open}
      >
        <span className="join-tab-tip" aria-hidden="true">
          ▲
        </span>
        <span className="join-tab-label">Inscribete</span>
      </button>

      <JoinDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
