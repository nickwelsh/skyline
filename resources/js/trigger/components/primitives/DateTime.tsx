/*!
 * Adapted from Trigger.dev apps/webapp/app/components/primitives/DateTime.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: retained reached short, accurate, and relative presenters; replaced provider data with browser Intl.
 */
import { formatDistanceToNow } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { SimpleTooltip } from "./Tooltip";

type DateTimeShortProps = {
  date: Date | string;
  hour12?: boolean;
  includeSeconds?: boolean;
  includeTime?: boolean;
  includeDate?: boolean;
};

export const DateTime = ({ date, hour12 = true, includeSeconds = true, includeTime = true, includeDate = true }: DateTimeShortProps) => {
  const realDate = typeof date === "string" ? new Date(date) : date;
  const formattedDateTime = new Intl.DateTimeFormat(browserLocales(), {
    year: includeDate ? "numeric" : undefined,
    month: includeDate ? "short" : undefined,
    day: includeDate ? "numeric" : undefined,
    hour: includeTime ? "numeric" : undefined,
    minute: includeTime ? "numeric" : undefined,
    second: includeTime && includeSeconds ? "numeric" : undefined,
    timeZone: browserTimeZone(),
    hour12,
  }).format(realDate);

  return <span suppressHydrationWarning>{formattedDateTime.replace(/\s/g, String.fromCharCode(32))}</span>;
};

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

export const DateTimeAccurate = ({ date, hour12 = true }: DateTimeShortProps) => {
  const realDate = typeof date === "string" ? new Date(date) : date;
  const locales = browserLocales();
  const timeZone = browserTimeZone();
  const datePart = new Intl.DateTimeFormat(locales, { month: "short", day: "numeric", timeZone }).format(realDate);
  const timePart = formatDateTimeShort(realDate, timeZone, locales, hour12);

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

function browserTimeZone(): string | undefined {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
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
