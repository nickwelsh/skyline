declare module "virtual:pinned-trigger-run-error" {
  export function PinnedTriggerRunError({ error }: {
    error: {
      type: "BUILT_IN_ERROR";
      name: string;
      message: string;
      stackTrace: string;
    };
  }): React.JSX.Element;
}
