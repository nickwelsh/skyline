/*!
 * Adapted from Trigger.dev apps/webapp/app/components/primitives/Dialog.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 */
import { XMarkIcon } from "@heroicons/react/24/solid";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";

const Dialog = DialogPrimitive.Root;

const DialogPortal = ({ children, ...props }: DialogPrimitive.DialogPortalProps) => (
  <DialogPrimitive.Portal {...props}>
    <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
      {children}
    </div>
  </DialogPrimitive.Portal>
);

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={`fixed inset-0 z-50 bg-background-dimmed/90 backdrop-blur-xs transition-all duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in ${className ?? ""}`}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={`fixed z-50 w-full rounded-b-lg border bg-background-dimmed shadow-lg animate-in data-[state=open]:fade-in-90 data-[state=open]:slide-in-from-bottom-10 sm:rounded-lg sm:zoom-in-90 sm:data-[state=open]:slide-in-from-bottom-0 ${className ?? ""}`}
      {...props}
    >
      <hr className="absolute left-0 top-11 w-full border-grid-bright" />
      {children}
      <DialogPrimitive.Close className="group absolute right-2 top-2.25 flex items-center gap-1 rounded-sm py-1 pr-1 opacity-70 transition focus-custom hover:bg-background-hover hover:opacity-100 focus-visible:focus-custom disabled:pointer-events-none">
        <kbd className="rounded border border-grid-bright px-1 font-mono text-xs uppercase text-text-faint">Esc</kbd>
        <XMarkIcon className="size-4 text-text-dimmed transition group-hover:text-text-bright" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col text-left font-medium text-text-bright ${className ?? ""}`} {...props} />
);

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={`text-base font-normal text-text-bright ${className ?? ""}`} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export { Dialog, DialogContent, DialogHeader, DialogTitle };
