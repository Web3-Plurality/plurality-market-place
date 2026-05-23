/**
 * Extension Sync Utilities
 * Browser Extension Integration for plurality-memory-studio
 *
 * Sends auth and profile events to the Plurality browser extension
 * via window.postMessage. The extension's content script listens
 * for messages with source: 'plurality-app'.
 */

/**
 * Sync login credentials with the browser extension.
 * Sends token, chatEncKey, and userId so the extension can
 * store them for encrypted thread storage.
 */
export function syncLoginWithExtension(token: string, chatEncKey: string, userId: string): void {
  if (!token) {
    console.warn('[Plurality] Cannot sync empty token');
    return;
  }

  window.postMessage(
    {
      source: 'plurality-app',
      action: 'loginSuccess',
      token,
      chatEncKey,
      userId,
    },
    '*'
  );
}

/**
 * Sync login with extension and wait for acknowledgment.
 * If extension acknowledges, it will close the tab - caller should NOT navigate.
 * If no acknowledgment (extension not installed or timeout), caller should navigate.
 *
 * @returns Promise<boolean> - true if extension acknowledged (will close tab), false otherwise
 */
export function syncLoginAndWaitForClose(
  token: string,
  chatEncKey: string,
  userId: string
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!token) {
      console.warn('[Plurality] Cannot sync empty token');
      resolve(false);
      return;
    }

    let acknowledged = false;

    const handler = (event: MessageEvent) => {
      if (
        event.source === window &&
        event.data.source === 'plurality-extension' &&
        event.data.action === 'loginSuccessAcknowledged'
      ) {
        acknowledged = true;
        window.removeEventListener('message', handler);
        resolve(true);
      }
    };

    window.addEventListener('message', handler);

    // Send login success message
    window.postMessage(
      {
        source: 'plurality-app',
        action: 'loginSuccess',
        token,
        chatEncKey,
        userId,
      },
      '*'
    );

    // Wait for acknowledgment with timeout
    // Extension needs time to fetch profiles from API
    setTimeout(() => {
      if (!acknowledged) {
        window.removeEventListener('message', handler);
        resolve(false);
      }
    }, 5000);
  });
}

/**
 * Request extension status (check if extension is installed and ready).
 * The extension responds with an 'extensionReady' message.
 */
export function requestExtensionStatus(): void {
  window.postMessage(
    {
      source: 'plurality-app',
      action: 'requestExtensionStatus',
    },
    '*'
  );
}

/**
 * Check if the extension is installed and ready.
 * Returns true only if the extension responds within 2 seconds.
 */
export function checkExtensionInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    let received = false;

    const handler = (event: MessageEvent) => {
      if (
        event.source === window &&
        event.data.source === 'plurality-extension' &&
        event.data.action === 'extensionReady'
      ) {
        received = true;
        resolve(true);
        window.removeEventListener('message', handler);
      }
    };

    window.addEventListener('message', handler);
    requestExtensionStatus();

    // Timeout after 2 seconds
    setTimeout(() => {
      if (!received) {
        window.removeEventListener('message', handler);
        resolve(false);
      }
    }, 2000);
  });
}

/**
 * Notify extension that the user's account has been deleted.
 * Extension will immediately clear all stored auth data and logout.
 */
export function notifyExtensionAccountDeleted(): void {
  window.postMessage(
    {
      source: 'plurality-app',
      action: 'accountDeleted',
    },
    '*'
  );
}

/**
 * Notify extension about profile changes (creation, edit, deletion).
 * Extension broadcasts these to all tabs to update UI.
 */
export function notifyExtensionProfileEvent(
  eventType: 'newProfileCreated' | 'profileEdited' | 'profileDeleted',
  profiles: unknown[],
  profileId: string | null
): void {
  window.postMessage(
    {
      source: 'plurality-app',
      action: eventType,
      profiles,
      profileId,
    },
    '*'
  );
}

/**
 * Notify extension about onboarding/tour actions.
 * Used to coordinate between Memory Studio and extension during onboarding.
 */
export function notifyExtensionAction(
  action:
    | 'tourCompleted'
    | 'userChoseExtension'
    | 'userChoseMemoryStudio'
    | 'saveContextComplete'
    | 'requestOpenPopup'
): void {
  window.postMessage(
    {
      source: 'plurality-app',
      action,
    },
    '*'
  );
}

const ONBOARDING_SOURCE_KEY = 'plurality_onboarding_source';

/**
 * Detect onboarding source from URL parameters or sessionStorage.
 * Returns the source type: 'direct', 'extension', 'save-context', or 'third-party'
 */
export function getOnboardingSource(): 'direct' | 'extension' | 'save-context' | 'third-party' {
  // First check URL params
  const params = new URLSearchParams(window.location.search);
  const urlSource = params.get('source') || params.get('from');

  if (urlSource === 'extension' || urlSource === 'ext') {
    return 'extension';
  }
  if (urlSource === 'third-party') {
    return 'third-party';
  }
  if (urlSource === 'save-context' || urlSource === 'save') {
    return 'save-context';
  }

  // Fall back to sessionStorage (preserved across login redirect)
  try {
    const storedSource = sessionStorage.getItem(ONBOARDING_SOURCE_KEY);
    if (storedSource === 'extension' || storedSource === 'save-context' || storedSource === 'third-party') {
      return storedSource as 'extension' | 'save-context' | 'third-party';
    }
  } catch {
    // sessionStorage may be unavailable
  }

  return 'direct';
}

/**
 * Store onboarding source in sessionStorage.
 * Call this on the login page to preserve source through redirect.
 */
export function storeOnboardingSource(): void {
  const params = new URLSearchParams(window.location.search);
  const source = params.get('source') || params.get('from');

  try {
    if (source === 'extension' || source === 'ext') {
      sessionStorage.setItem(ONBOARDING_SOURCE_KEY, 'extension');
    } else if (source === 'third-party') {
      sessionStorage.setItem(ONBOARDING_SOURCE_KEY, 'third-party');
    } else if (source === 'save-context' || source === 'save') {
      sessionStorage.setItem(ONBOARDING_SOURCE_KEY, 'save-context');
    }
  } catch {
    // sessionStorage may be unavailable
  }
}

/**
 * Clear onboarding source from URL and sessionStorage.
 */
export function clearOnboardingSource(): void {
  // Clear URL params
  const url = new URL(window.location.href);
  url.searchParams.delete('source');
  url.searchParams.delete('from');
  window.history.replaceState({}, '', url.toString());

  // Clear sessionStorage
  try {
    sessionStorage.removeItem(ONBOARDING_SOURCE_KEY);
  } catch {
    // sessionStorage may be unavailable
  }
}

/**
 * @deprecated Use clearOnboardingSource instead
 */
export function clearOnboardingSourceFromUrl(): void {
  clearOnboardingSource();
}
