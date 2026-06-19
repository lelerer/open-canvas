// LangSmith run-sharing is disabled for this instance: no LangSmith tenant /
// API key is configured, so hitting the share endpoint just spams 401s after
// every message. Flip this to `true` (and configure LANGCHAIN_API_KEY) to
// re-enable the public "view run" links.
const SHARING_ENABLED = false;

export function useRuns() {
  /**
   * Generates a public shared run ID for the given run ID.
   */
  const shareRun = async (runId: string): Promise<string | undefined> => {
    if (!SHARING_ENABLED) {
      return undefined;
    }

    const res = await fetch("/api/runs/share", {
      method: "POST",
      body: JSON.stringify({ runId }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return;
    }

    const { sharedRunURL } = await res.json();
    return sharedRunURL;
  };

  return {
    shareRun,
  };
}
