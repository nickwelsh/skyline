/*!
 * Derived from Trigger.dev apps/webapp/app/components/primitives/Buttons.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Narrowed to reached variants, browser-native anchor navigation, and reached ARIA toggle state.
 */
import React, {
  forwardRef,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Link } from "@remix-run/react";

import { type ShortcutDefinition, useShortcutKeys } from "../../hooks/useShortcutKeys";
import { cn } from "../../utils/cn";
import { Icon, type RenderIcon } from "./Icon";
import { ShortcutKey } from "./ShortcutKey";
import { Spinner } from "./Spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./Tooltip";

const sizes = {
  small: {
    button: "h-6 px-2.5 text-xs",
    icon: "h-3.5 -mx-1",
    iconSpacing: "gap-x-2.5",
    shortcutVariant: "small" as const,
    shortcut: "-ml-0.5 -mr-1.5 justify-self-center",
  },
  "small-icon": {
    button: "h-6 min-w-[34px] px-2 text-xs",
    icon: "h-3.5 -mx-1",
    iconSpacing: "gap-x-2.5",
    shortcutVariant: "small" as const,
    shortcut: "-ml-0.5 -mr-1.5 justify-self-center",
  },
  medium: {
    button: "h-8 px-3 text-sm",
    icon: "h-4 -mx-1",
    iconSpacing: "gap-x-2.5",
    shortcutVariant: "medium" as const,
    shortcut: "-ml-0.5 -mr-1.5 rounded justify-self-center",
  },
};

type Size = keyof typeof sizes;

const theme = {
  primary: {
    textColor: "text-white transition group-disabled/button:text-white/60",
    button:
      "bg-indigo-600 border border-indigo-500 group-hover/button:bg-indigo-500 group-hover/button:border-indigo-400 group-disabled/button:opacity-50 group-disabled/button:bg-indigo-600 group-disabled/button:border-indigo-500 group-disabled/button:pointer-events-none",
    shortcut:
      "border-white/40 text-white group-hover/button:border-white/60 group-hover/button:text-white",
    icon: "text-white",
  },
  secondary: {
    textColor: "text-text-bright transition group-disabled/button:text-text-dimmed/80",
    button:
      "bg-secondary border border-border-bright/50 shadow-xs group-hover/button:bg-background-raised group-disabled/button:bg-secondary group-disabled/button:opacity-60 group-disabled/button:pointer-events-none",
    shortcut:
      "border-text-dimmed/40 text-text-dimmed group-hover/button:text-text-bright group-hover/button:border-text-dimmed",
    icon: "text-text-bright",
  },
  tertiary: {
    textColor: "text-text-bright transition group-disabled/button:text-text-dimmed/80",
    button:
      "bg-tertiary group-hover/button:bg-surface-control group-disabled/button:bg-tertiary group-disabled/button:opacity-60 group-disabled/button:pointer-events-none",
    shortcut:
      "border-text-dimmed/40 text-text-dimmed group-hover/button:text-text-bright group-hover/button:border-text-dimmed",
    icon: "text-text-bright",
  },
  minimal: {
    textColor: "text-text-dimmed group-disabled/button:text-text-dimmed transition",
    button:
      "bg-transparent group-hover/button:bg-tertiary disabled:opacity-50 group-disabled/button:bg-transparent group-disabled/button:pointer-events-none",
    shortcut:
      "border-dimmed/40 text-text-dimmed group-hover/button:text-text-bright/80 group-hover/button:border-dimmed/60",
    icon: "text-text-dimmed",
  },
  danger: {
    textColor: "text-white transition group-disabled/button:text-white/80",
    button:
      "bg-error group-hover/button:bg-rose-500 disabled:opacity-50 group-disabled/button:bg-error group-disabled/button:pointer-events-none",
    shortcut: "border-white text-white group-hover/button:border-white/60",
    icon: "text-white",
  },
};

type Theme = keyof typeof theme;

function createVariant(sizeName: Size, themeName: Theme) {
  return {
    textColor: theme[themeName].textColor,
    button: cn(sizes[sizeName].button, theme[themeName].button),
    icon: cn(sizes[sizeName].icon, theme[themeName].icon),
    iconSpacing: sizes[sizeName].iconSpacing,
    shortcutVariant: sizes[sizeName].shortcutVariant,
    shortcut: cn(sizes[sizeName].shortcut, theme[themeName].shortcut),
  };
}

const variant = {
  "primary/small": createVariant("small", "primary"),
  "primary/medium": createVariant("medium", "primary"),
  "secondary/small": createVariant("small", "secondary"),
  "secondary/small-icon": createVariant("small-icon", "secondary"),
  "secondary/medium": createVariant("medium", "secondary"),
  "tertiary/medium": createVariant("medium", "tertiary"),
  "minimal/small": createVariant("small", "minimal"),
  "minimal/medium": createVariant("medium", "minimal"),
  "danger/small": createVariant("small", "danger"),
  "small-menu-item": {
    textColor: "text-text-bright",
    button: "h-[1.8rem] px-[0.4rem] text-2sm rounded-sm text-text-dimmed bg-transparent group-hover/button:bg-background-hover",
    icon: "h-[1.125rem]",
    iconSpacing: "gap-x-1.5",
    shortcutVariant: "medium" as const,
    shortcut: undefined,
  },
};

const allVariants = {
  $all: "cursor-pointer font-normal text-center font-sans justify-center items-center shrink-0 transition duration-150 rounded-[3px] select-none group-focus/button:outline-hidden group-disabled/button:opacity-75 group-disabled/button:pointer-events-none focus-custom",
  variant,
};

export type ButtonVariant = keyof typeof variant;

export type ButtonContentPropsType = {
  children?: React.ReactNode;
  LeadingIcon?: RenderIcon;
  TrailingIcon?: RenderIcon;
  trailingIconClassName?: string;
  leadingIconClassName?: string;
  fullWidth?: boolean;
  textAlignLeft?: boolean;
  className?: string;
  shortcut?: ShortcutDefinition;
  variant: ButtonVariant;
  shortcutPosition?: "before-trailing-icon" | "after-trailing-icon";
  tooltip?: ReactNode;
  iconSpacing?: string;
  hideShortcutKey?: boolean;
  isLoading?: boolean;
};

export function ButtonContent(props: ButtonContentPropsType) {
  const {
    children: text,
    LeadingIcon,
    TrailingIcon,
    trailingIconClassName,
    leadingIconClassName,
    shortcut,
    fullWidth,
    textAlignLeft,
    className,
    tooltip,
    iconSpacing,
    hideShortcutKey,
    isLoading,
  } = props;

  const [showSpinner, setShowSpinner] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setShowSpinner(false);
      return;
    }
    const timer = setTimeout(() => setShowSpinner(true), 200);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const variation = allVariants.variant[props.variant];
  const btnClassName = cn(allVariants.$all, variation.button);

  const renderShortcutKey = () =>
    shortcut &&
    !hideShortcutKey && (
      <ShortcutKey
        className={cn(variation.shortcut)}
        shortcut={shortcut}
        variant={variation.shortcutVariant}
      />
    );

  const buttonContent = (
    <div className={cn("flex", fullWidth ? "" : "w-fit text-xxs", btnClassName, className)}>
      <div className="relative flex w-full items-center">
        <div
          className={cn(
            textAlignLeft ? "text-left" : "justify-center",
            "flex w-full items-center",
            variation.iconSpacing,
            iconSpacing,
            showSpinner && "invisible"
          )}
        >
          {LeadingIcon && (
            <Icon
              icon={LeadingIcon}
              className={cn(
                variation.icon,
                leadingIconClassName,
                "shrink-0 justify-start"
              )}
            />
          )}

          {text &&
            (typeof text === "string" ? (
              <span className={cn("mx-auto grow self-center truncate", variation.textColor)}>
                {text}
              </span>
            ) : (
              <>{text}</>
            ))}

          {shortcut &&
            !tooltip &&
            props.shortcutPosition === "before-trailing-icon" &&
            renderShortcutKey()}

          {TrailingIcon && (
            <Icon
              icon={TrailingIcon}
              className={cn(
                variation.icon,
                trailingIconClassName,
                "shrink-0 justify-end"
              )}
            />
          )}

          {shortcut &&
            !tooltip &&
            (!props.shortcutPosition || props.shortcutPosition === "after-trailing-icon") &&
            renderShortcutKey()}
        </div>
        {showSpinner && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner className="size-3.5" color="white" />
          </span>
        )}
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
          <TooltipContent className="flex items-center gap-1.5 py-1.5 pl-2.5 pr-2 text-xs text-text-bright">
            {tooltip} {shortcut && renderShortcutKey()}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return buttonContent;
}

type ButtonPropsType = Pick<
  JSX.IntrinsicElements["button"],
  "type" | "disabled" | "onClick" | "name" | "value" | "form" | "autoFocus" | "aria-label" | "aria-controls" | "aria-expanded" | "aria-pressed"
> &
  React.ComponentProps<typeof ButtonContent>;

export const Button = forwardRef<HTMLButtonElement, ButtonPropsType>(
  ({ type, disabled, autoFocus, onClick, "aria-label": ariaLabel, "aria-controls": ariaControls, "aria-expanded": ariaExpanded, "aria-pressed": ariaPressed, ...props }, ref) => {
    const innerRef = useRef<HTMLButtonElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLButtonElement);

    const isDisabled = disabled || props.isLoading;

    useShortcutKeys({
      shortcut: props.shortcut,
      action: (event) => {
        if (innerRef.current) {
          innerRef.current.click();
          event.preventDefault();
          event.stopPropagation();
        }
      },
      disabled: isDisabled || !props.shortcut,
    });

    const buttonElement = (
      <button
        className={cn("group/button outline-hidden focus-custom", props.fullWidth ? "w-full" : "")}
        type={type}
        disabled={isDisabled}
        onClick={onClick}
        name={props.name}
        value={props.value}
        ref={innerRef}
        form={props.form}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-controls={ariaControls}
        aria-expanded={ariaExpanded}
        aria-pressed={ariaPressed}
      >
        <ButtonContent
          {...props}
          tooltip={undefined}
          hideShortcutKey={props.tooltip ? true : props.hideShortcutKey}
        />
      </button>
    );

    if (props.tooltip) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn("flex", isDisabled && "cursor-default")}>{buttonElement}</span>
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-1.5 py-1.5 pl-2.5 pr-2 text-xs text-text-bright">
              {props.tooltip}{" "}
              {props.shortcut && !props.hideShortcutKey && (
                <ShortcutKey shortcut={props.shortcut} variant="medium" />
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return buttonElement;
  }
);

type LinkPropsType = Pick<
  JSX.IntrinsicElements["a"],
  | "target"
  | "onClick"
  | "onMouseDown"
  | "onMouseEnter"
  | "onMouseLeave"
  | "download"
  | "aria-label"
> & {
  to: string;
  disabled?: boolean;
} & React.ComponentProps<typeof ButtonContent>;

export const LinkButton = ({
  to,
  target,
  onClick,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  download,
  "aria-label": ariaLabel,
  disabled = false,
  ...props
}: LinkPropsType) => {
  const innerRef = useRef<HTMLAnchorElement>(null);
  const accessibleLabel = ariaLabel !== undefined
    ? ariaLabel
    : typeof props.tooltip === "string" && props.tooltip.trim() !== ""
      ? props.tooltip.trim()
      : undefined;

  useShortcutKeys({
    shortcut: props.shortcut,
    action: () => innerRef.current?.click(),
    disabled: disabled || !props.shortcut,
  });

  if (disabled) {
    return (
      <div
        className={cn(
          "group/button pointer-events-none cursor-default opacity-40 outline-hidden",
          props.fullWidth ? "w-full" : ""
        )}
      >
        <ButtonContent {...props} />
      </div>
    );
  }

  const opensInNewTab = target ??
    (to.startsWith("http") || to.startsWith("/resources") ? "_blank" : undefined);
  const isExternalOrResource = to.startsWith("http") || to.startsWith("/resources");

  return (
    <Link
      to={to}
      ref={innerRef}
      target={opensInNewTab}
      rel={opensInNewTab === "_blank" ? "noopener noreferrer" : undefined}
      className={cn(
        "group/button block focus-custom",
        props.fullWidth ? "w-full" : isExternalOrResource ? "" : "w-fit"
      )}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      download={download}
      aria-label={accessibleLabel}
    >
      <ButtonContent {...props} />
    </Link>
  );
};
