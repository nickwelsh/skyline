/*!
 * Adapted from Trigger.dev apps/webapp/app/components/primitives/DateTime.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: retained reached short, accurate, and relative presenters; replaced provider data with browser Intl.
 */
import { GlobeAmericasIcon } from "@heroicons/react/20/solid";
import { formatDistanceToNow } from "date-fns";
import { Laptop } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { GlobeLinesIcon } from "~/assets/icons/GlobeLinesIcon";
import { CopyButton } from "./CopyButton";
import { Paragraph } from "./Paragraph";
import { SimpleTooltip } from "./Tooltip";

type DateTimeShortProps = {
  date: Date | string;
  previousDate?: Date | string | null;
  timeZone?: string;
  hour12?: boolean;
  includeSeconds?: boolean;
  includeTime?: boolean;
  includeDate?: boolean;
  showTimezone?: boolean;
  showTooltip?: boolean;
};

export const DateTime = ({
  date,
  timeZone,
  hour12 = true,
  includeSeconds = true,
  includeTime = true,
  includeDate = true,
  showTimezone = false,
  showTooltip = true,
}: DateTimeShortProps) => {
  const realDate = useMemo(() => typeof date === "string" ? new Date(date) : date, [date]);
  const locales = browserLocales();
  const localTimeZone = browserTimeZone();
  const displayTimeZone = timeZone ?? localTimeZone;
  const formattedDateTime = (
    <span suppressHydrationWarning>
      {formatDateTime(realDate, displayTimeZone, locales, includeSeconds, includeTime, includeDate, hour12).replace(/\s/g, String.fromCharCode(32))}
      {showTimezone ? ` (${timeZone ?? "UTC"})` : null}
    </span>
  );

  if (!showTooltip) return formattedDateTime;

  return (
    <SimpleTooltip
      button={formattedDateTime}
      content={<DateTimeTooltip realDate={realDate} timeZone={timeZone} localTimeZone={localTimeZone} locales={locales} />}
      side="right"
      asChild
    />
  );
};

export function formatDateTime(
  date: Date,
  timeZone: string | undefined,
  locales: string[] | undefined,
  includeSeconds: boolean,
  includeTime: boolean,
  includeDate: boolean = true,
  hour12: boolean = true
): string {
  return new Intl.DateTimeFormat(locales, {
    year: includeDate ? "numeric" : undefined,
    month: includeDate ? "short" : undefined,
    day: includeDate ? "numeric" : undefined,
    hour: includeTime ? "numeric" : undefined,
    minute: includeTime ? "numeric" : undefined,
    second: includeTime && includeSeconds ? "numeric" : undefined,
    timeZone,
    hour12,
  }).format(date);
}

export const DateTimeShort = ({ date, hour12 = true }: DateTimeShortProps) => {
  const realDate = typeof date === "string" ? new Date(date) : date;
  const formattedDateTime = formatDateTimeShort(
    realDate,
    browserTimeZone(),
    browserLocales(),
    hour12
  );

  return (
    <span suppressHydrationWarning>
      {formattedDateTime.replace(/\s/g, String.fromCharCode(32))}
    </span>
  );
};

export const DateTimeAccurate = ({ date, previousDate = null, hour12 = true }: DateTimeShortProps) => {
  const realDate = typeof date === "string" ? new Date(date) : date;
  const realPreviousDate = typeof previousDate === "string" ? new Date(previousDate) : previousDate;
  const locales = browserLocales();
  const timeZone = browserTimeZone();
  const timePart = formatDateTimeShort(realDate, timeZone, locales, hour12);
  const sameDay = realPreviousDate && new Intl.DateTimeFormat("en-CA", { timeZone }).format(realDate) === new Intl.DateTimeFormat("en-CA", { timeZone }).format(realPreviousDate);
  if (sameDay) return <span suppressHydrationWarning>{timePart.replace(/\s/g, String.fromCharCode(32))}</span>;
  const datePart = new Intl.DateTimeFormat(locales, { month: "short", day: "numeric", timeZone }).format(realDate);

  return <span suppressHydrationWarning>{`${datePart} ${timePart}`.replace(/\s/g, String.fromCharCode(32))}</span>;
};

type RelativeDateTimeProps = {
  date: Date | string;
  capitalize?: boolean;
};

function getRelativeText(date: Date, capitalize = true): string {
  const text = formatDistanceToNow(date, { addSuffix: true });
  return capitalize ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export const RelativeDateTime = ({ date, capitalize = true }: RelativeDateTimeProps) => {
  const realDate = useMemo(() => typeof date === "string" ? new Date(date) : date, [date]);
  const [relativeText, setRelativeText] = useState(() => getRelativeText(realDate, capitalize));

  useEffect(() => {
    const interval = window.setInterval(() => setRelativeText(getRelativeText(realDate, capitalize)), 60_000);
    return () => window.clearInterval(interval);
  }, [realDate, capitalize]);

  useEffect(() => setRelativeText(getRelativeText(realDate, capitalize)), [realDate, capitalize]);

  return (
    <SimpleTooltip
      button={<span suppressHydrationWarning>{relativeText}</span>}
      content={<DateTime date={realDate} />}
      side="right"
      asChild
    />
  );
};

export function formatDateTimeISO(date: Date, timeZone: string): string {
  if (timeZone === "UTC") return date.toISOString();

  const dateParts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  const offset = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}.${String(date.getMilliseconds()).padStart(3, "0")}${offset}`;
}

export function formatUtcOffset(date: Date, timeZone: string): string {
  if (timeZone === "UTC") return "";
  const raw = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value.replace("GMT", "") ?? "";
  const match = raw.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return "(UTC +0)";
  const [, sign, hh, mm] = match;
  const hours = parseInt(hh, 10);
  const minutes = parseInt(mm, 10);
  return `(UTC ${sign}${hours}${minutes ? `:${minutes.toString().padStart(2, "0")}` : ""})`;
}

function DateTimeTooltipContent({ title, dateTime, isoDateTime, icon, offset }: {
  title: string;
  dateTime: string;
  isoDateTime: string;
  icon: ReactNode;
  offset?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-sm">
        {icon}
        <span className="font-medium">{title}</span>
        {offset ? <span className="font-normal text-text-dimmed">{offset}</span> : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Paragraph variant="extra-small" className="text-text-dimmed">{dateTime}</Paragraph>
        <CopyButton value={isoDateTime} variant="icon" size="extra-small" showTooltip={false} />
      </div>
    </div>
  );
}

function DateTimeTooltip({ realDate, timeZone, localTimeZone, locales }: {
  realDate: Date;
  timeZone?: string;
  localTimeZone: string;
  locales: string[] | undefined;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-2.5 pb-1">
        {timeZone && timeZone !== "UTC" ? (
          <DateTimeTooltipContent
            title={timeZone}
            dateTime={formatDateTime(realDate, timeZone, locales, true, true, true)}
            isoDateTime={formatDateTimeISO(realDate, timeZone)}
            icon={<GlobeAmericasIcon className="size-4 text-purple-500" />}
          />
        ) : null}
        <DateTimeTooltipContent
          title="UTC"
          dateTime={formatDateTime(realDate, "UTC", locales, true, true, true)}
          isoDateTime={formatDateTimeISO(realDate, "UTC")}
          icon={<GlobeLinesIcon className="size-4 text-blue-500" />}
        />
        <DateTimeTooltipContent
          title="Local"
          dateTime={formatDateTime(realDate, localTimeZone, locales, true, true, true)}
          isoDateTime={formatDateTimeISO(realDate, localTimeZone)}
          icon={<Laptop className="size-4 text-green-500" />}
          offset={formatUtcOffset(realDate, localTimeZone)}
        />
      </div>
    </div>
  );
}

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function browserLocales(): string[] | undefined {
  if (typeof navigator === "undefined") return undefined;
  if (navigator.languages.length > 0) return [...navigator.languages];
  return navigator.language ? [navigator.language] : undefined;
}

function formatDateTimeShort(
  date: Date,
  timeZone: string | undefined,
  locales: string[] | undefined,
  hour12: boolean = true
): string {
  const formattedDateTime = new Intl.DateTimeFormat(locales, {
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    timeZone,
    // @ts-ignore fractionalSecondDigits works in most modern browsers
    fractionalSecondDigits: 3,
    hour12,
  }).format(date);

  return formattedDateTime;
}
