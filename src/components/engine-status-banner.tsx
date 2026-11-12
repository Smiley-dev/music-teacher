import type { ReactNode } from "react";
import { AlertTriangle, Loader2, MicOff, ShieldAlert, Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type EngineStatus, openMicrophonePrivacySettings } from "@/lib/engine";
import { cn } from "@/lib/utils";

type BannerProps = {
  tone: "muted" | "warning" | "error";
  icon: ReactNode;
  title: string;
  children?: ReactNode;
};

function Banner({ tone, icon, title, children }: BannerProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 text-sm",
        tone === "warning" && "border-amber-500/50 bg-amber-500/10",
        tone === "error" && "border-destructive/50 bg-destructive/5",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        {children && <div className="text-muted-foreground">{children}</div>}
      </div>
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
          icon={<Loader2 className="size-5 animate-spin text-muted-foreground" />}
          title={device ? `Opening ${device}…` : "Opening input device…"}
        />
      );
    case "reconnecting":
      return (
        <Banner
          tone="warning"
          icon={<Loader2 className="size-5 animate-spin text-amber-500" />}
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
          icon={<ShieldAlert className="size-5 text-destructive" />}
          title="Windows is blocking access to the microphone"
        >
          <p>
            Turn on “Let desktop apps access your microphone” in Windows privacy settings. The app
            will connect automatically once access is allowed.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => openMicrophonePrivacySettings().catch(() => {})}
          >
            Open privacy settings
          </Button>
        </Banner>
      );
    case "noDevices":
      return (
        <Banner
          tone="error"
          icon={<MicOff className="size-5 text-destructive" />}
          title="No input devices found"
        >
          Plug in your audio interface or microphone. The app keeps looking and will connect as
          soon as one appears.
        </Banner>
      );
    case "deviceLost":
      return (
        <Banner
          tone="error"
          icon={<Unplug className="size-5 text-destructive" />}
          title={device ? `${device} is not connected` : "The input device is not connected"}
        >
          Plug it in (the app reconnects automatically) or choose another device in Settings.
        </Banner>
      );
    default:
      return (
        <Banner
          tone="error"
          icon={<AlertTriangle className="size-5 text-destructive" />}
          title="Could not read from the input device"
        >
          {error?.message ?? "Unknown error."} The app keeps retrying; you can also choose another
          device in Settings.
        </Banner>
      );
  }
}
