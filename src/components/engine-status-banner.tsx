import type { ReactNode } from "react";
import { AlertTriangle, Loader2, MicOff, ShieldAlert, Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type EngineStatus, openMicrophonePrivacySettings } from "@/lib/engine";
import { cn } from "@/lib/utils";

type BannerProps = {
  tone: "muted" | "warning" | "error";
  /** Small caps state name above the title ("DEVICE LOST"). */
  label: string;
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  /** A key at the right (e.g. "Open privacy settings"). */
  action?: ReactNode;
};

function Banner({ tone, label, icon, title, children, action }: BannerProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-start gap-3.5 rounded-xl border px-4 py-3.5 text-sm",
        tone === "muted" && "bg-card",
        tone === "warning" && "border-amber-500/40 bg-amber-500/10",
        tone === "error" && "border-red-500/40 bg-red-500/10",
      )}
    >
      <span
        className={cn(
          "flex size-[34px] shrink-0 items-center justify-center rounded-lg [&_svg]:size-[17px]",
          tone === "muted" && "bg-muted text-muted-foreground",
          tone === "warning" && "bg-amber-500 text-primary-foreground",
          tone === "error" && "bg-red-500 text-[var(--stop-foreground)]",
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-[1_1_24rem] flex-col gap-1">
        <span
          className={cn(
            "font-mono text-[10px] tracking-[0.14em] uppercase",
            tone === "muted" && "text-muted-foreground",
            tone === "warning" && "text-amber-600 dark:text-amber-400",
            tone === "error" && "text-red-600 dark:text-red-400",
          )}
        >
          {label}
        </span>
        <strong className="font-bold">{title}</strong>
        {children && <div className="text-muted-foreground">{children}</div>}
      </div>
      {action}
    </div>
  );
}

/**
 * Explains any engine state other than "running", with what to do next.
 * Renders nothing while the stream runs normally.
 */
export function EngineStatusBanner({ status }: { status: EngineStatus }) {
  const device = status.device?.name;

  switch (status.state) {
    case "running":
      return null;
    case "starting":
      return (
        <Banner
          tone="muted"
          label="Starting"
          icon={<Loader2 className="animate-spin" />}
          title={device ? `Opening ${device}…` : "Opening input device…"}
        />
      );
    case "reconnecting":
      return (
        <Banner
          tone="warning"
          label="Reconnecting · retry every 750 ms"
          icon={<Loader2 className="animate-spin" />}
          title="Lost connection to the device, reconnecting…"
        >
          This can happen briefly when plugging in a cable or if the USB connection resets. If
          it continues, check the cable or pick another device in Settings.
          {status.error && <p className="mt-1 text-xs">Details: {status.error.message}</p>}
        </Banner>
      );
    case "error":
      break;
  }

  const error = status.error;
  switch (error?.kind) {
    case "permissionDenied":
      return (
        <Banner
          tone="error"
          label="Permission denied"
          icon={<ShieldAlert />}
          title="Windows is blocking access to the microphone"
          action={
            <Button
              variant="outline"
              onClick={() => openMicrophonePrivacySettings().catch(() => {})}
            >
              Open privacy settings
            </Button>
          }
        >
          Turn on “Let desktop apps access your microphone” in Windows privacy settings. The app
          will connect automatically once access is allowed.
        </Banner>
      );
    case "noDevices":
      return (
        <Banner tone="error" label="No devices" icon={<MicOff />} title="No input devices found">
          Plug in your audio interface or microphone. The app keeps looking and will connect as
          soon as one appears.
        </Banner>
      );
    case "deviceLost":
      return (
        <Banner
          tone="error"
          label="Device lost"
          icon={<Unplug />}
          title={device ? `${device} is not connected` : "The input device is not connected"}
        >
          Plug it in (the app reconnects automatically) or choose another device in Settings.
        </Banner>
      );
    default:
      return (
        <Banner
          tone="error"
          label="Other error"
          icon={<AlertTriangle />}
          title="Could not read from the input device"
        >
          {error?.message ?? "Unknown error."} The app keeps retrying; you can also choose another
          device in Settings.
        </Banner>
      );
  }
}
