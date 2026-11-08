import {
  instagramProfileName,
  type ProfileInfo,
  type ProfileRequest,
  type ProfileStartResult,
} from '@/lib/ephemera/profile-protocol';
import { fetchProfilePostsViaAPI } from './profile-api';
import { fetchProfileSummary } from './profile-graphql';
import { reportError } from './profile-report';
import { state } from './state';

/**
 * Answers the side panel: how many posts this profile has, and "start the run with these filters".
 * Only the top frame listens, so the panel gets exactly one answer.
 */
export function registerProfileBridge(): void {
  if (window !== window.top) return;

  chrome.runtime.onMessage.addListener((request: ProfileRequest, _sender, sendResponse) => {
    if (!request || typeof request !== 'object') return false;

    if (request.type === 'EPH_PROFILE_INFO') {
      const username = instagramProfileName(location.href);
      if (!username) {
        sendResponse({ ok: false, error: 'Open an Instagram profile first.' } satisfies ProfileInfo);
        return false;
      }
      fetchProfileSummary(username)
        .then((s) => sendResponse({ ok: true, username, totalPosts: s.totalPosts, highlights: s.highlightCount } satisfies ProfileInfo))
        .catch((e: unknown) => sendResponse({ ok: false, error: e instanceof Error ? e.message : 'Could not read this profile.' } satisfies ProfileInfo));
      return true;
    }

    if (request.type === 'EPH_PROFILE_START') {
      if (state.isProcessingProfile) {
        sendResponse({ ok: false, error: 'A download is already running on this tab.' } satisfies ProfileStartResult);
        return false;
      }
      if (!instagramProfileName(location.href)) {
        sendResponse({ ok: false, error: 'Open an Instagram profile first.' } satisfies ProfileStartResult);
        return false;
      }
      state.isProcessingProfile = true;
      sendResponse({ ok: true } satisfies ProfileStartResult);
      fetchProfilePostsViaAPI(request.filters, request.include).catch((e: unknown) => {
        // fetchProfilePostsViaAPI has already reported the reason to the panel
        console.error('[Ephemera] profile run failed:', e);
        reportError(e instanceof Error && e.message ? e.message : 'The run failed.');
      });
      return false;
    }
    return false;
  });
}
