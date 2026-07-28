"use client";

import { useState } from "react";

import { EyeIcon, EyeOffIcon } from "~/lib/icons";
import { Button } from "./button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group";
import type { InputProps } from "./input";

// The outer InputGroup shell only accepts a plain string className (it's a bare
// div), unlike Base UI's Input primitive which also allows a render-prop form.
type SecretInputProps = Omit<InputProps, "type" | "className"> & { className?: string };

// Masked credential field (API keys, tokens) with a show/hide toggle. Reuses the
// InputGroup shell so it matches every other settings text field visually.
export function SecretInput({ className, ...props }: SecretInputProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <InputGroup className={className}>
      <InputGroupInput type={revealed ? "text" : "password"} autoComplete="off" {...props} />
      <InputGroupAddon align="inline-end">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={revealed ? "Hide value" : "Show value"}
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      </InputGroupAddon>
    </InputGroup>
  );
}
