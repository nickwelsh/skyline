/*!
 * Adapted from Trigger.dev apps/webapp/app/components/primitives/DateTime.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: retained reached short and accurate presenters; replaced provider data with browser Intl.
 */

type DateTimeShortProps = {
  date: Date | string;
  hour12?: boolean;
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
