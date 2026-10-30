import { describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LiveClock, RefreshControl } from "@/components/ui-bits";
import { formatTimeAgo, formatUtcClock } from "@/lib/time";

describe("Live Time components", () => {
  it("formats relative time correctly", () => {
    const base = new Date("2026-10-30T12:00:00Z");
    expect(formatTimeAgo(undefined, base)).toBe("—");

    // Less than 5s
    expect(formatTimeAgo(base.getTime() - 2000, base)).toBe("just now");

    // 15s ago
    expect(formatTimeAgo(base.getTime() - 15000, base)).toBe("15s ago");

    // 2 minutes ago
    expect(formatTimeAgo(base.getTime() - 120000, base)).toBe("2m ago");

    // 3 hours ago
    expect(formatTimeAgo(base.getTime() - 10800000, base)).toBe("3h ago");
  });

  it("formats UTC clock string properly", () => {
    expect(formatUtcClock(null)).toBe("--:--:-- UTC");
    const d = new Date("2026-10-30T09:05:07Z");
    expect(formatUtcClock(d)).toBe("09:05:07 UTC");
  });

  it("renders LiveClock and ticks live", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T10:15:30Z"));

    render(<LiveClock />);
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("10:15:30 UTC")).toBeInTheDocument();

    // Advance time by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("10:15:35 UTC")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("renders RefreshControl with live time and sync age", () => {
    vi.useFakeTimers();
    const mockTime = new Date("2026-10-30T10:15:30Z");
    vi.setSystemTime(mockTime);

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <RefreshControl updatedAt={mockTime.getTime() - 10000} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("10:15:30 UTC")).toBeInTheDocument();
    expect(screen.getByText("10s ago")).toBeInTheDocument();

    // Advance time by 10s: live clock and relative time should update live without refresh
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText("10:15:40 UTC")).toBeInTheDocument();
    expect(screen.getByText("20s ago")).toBeInTheDocument();

    vi.useRealTimers();
  });
});
