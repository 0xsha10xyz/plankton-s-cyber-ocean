import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";

function Harness({ value, delay }: { value: string; delay: number }) {
  const v = useDebouncedValue(value, delay);
  return <div data-testid="v">{v}</div>;
}

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces updates by delay", () => {
    const { rerender } = render(<Harness value="a" delay={300} />);
    expect(screen.getByTestId("v")).toHaveTextContent("a");

    rerender(<Harness value="ab" delay={300} />);
    expect(screen.getByTestId("v")).toHaveTextContent("a");

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(screen.getByTestId("v")).toHaveTextContent("a");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("v")).toHaveTextContent("ab");
  });
});

