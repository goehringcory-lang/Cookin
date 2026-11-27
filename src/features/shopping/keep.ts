// Export to Google Keep.
//
// Google Keep's official API is only for Google Workspace admins, so a personal
// Gmail account can't be written to directly. The reliable route is plain text:
//  - On a phone, the share sheet (Web Share API) sends the list straight to the
//    Keep app, which creates a note. Tap "⋮ > Show checkboxes" and every line
//    becomes a checklist item.
//  - Anywhere else, copy to the clipboard. Pasting several lines into an
//    existing Keep checklist adds one item per line.

/** Minimal shape the Keep export needs. */
export interface KeepLine { name: string; amount?: string; checked: boolean }

export interface KeepTextOptions {
  /** Add amounts, e.g. "Flour (2 cups)". Default true. */
  amounts?: boolean;
  /** Include items already checked off. Default false. */
  includeChecked?: boolean;
}

/** One item per line, no bullets or headings, so Keep turns each line into a checkbox. */
export function toKeepText(items: KeepLine[], opts: KeepTextOptions = {}): string {
  const { amounts = true, includeChecked = false } = opts;
  return items
    .filter((i) => includeChecked || !i.checked)
    .map((i) => (amounts && i.amount ? `${i.name} (${i.amount})` : i.name))
    .join('\n');
}

export type ExportResult = 'shared' | 'copied' | 'cancelled' | 'failed';

interface ShareNavigator {
  share?: (data: { title?: string; text?: string }) => Promise<void>;
  canShare?: (data: { title?: string; text?: string }) => boolean;
  clipboard?: { writeText(text: string): Promise<void> };
}

/** True on devices with a native share sheet (phones, most tablets, Safari on Mac). */
export function canShareToKeep(nav: ShareNavigator | undefined = globalThis.navigator as ShareNavigator | undefined): boolean {
  if (!nav?.share) return false;
  try {
    return nav.canShare ? nav.canShare({ text: 'x' }) : true;
  } catch {
    return false;
  }
}

/** Opens the share sheet (pick Keep). Falls back to the clipboard. */
export async function shareToKeep(
  text: string,
  nav: ShareNavigator | undefined = globalThis.navigator as ShareNavigator | undefined,
): Promise<ExportResult> {
  if (canShareToKeep(nav)) {
    try {
      // No title: Keep would put it in the note body as an extra line on some phones.
      await nav!.share!({ text });
      return 'shared';
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return 'cancelled';
      // NotAllowedError etc. fall through to copy.
    }
  }
  return copyForKeep(text, nav);
}

export async function copyForKeep(
  text: string,
  nav: ShareNavigator | undefined = globalThis.navigator as ShareNavigator | undefined,
): Promise<ExportResult> {
  try {
    if (nav?.clipboard) {
      await nav.clipboard.writeText(text);
      return 'copied';
    }
  } catch {
    /* fall through to the textarea fallback */
  }
  return legacyCopy(text) ? 'copied' : 'failed';
}

function legacyCopy(text: string): boolean {
  const doc = (globalThis as { document?: Document }).document;
  if (!doc) return false;
  const ta = doc.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  doc.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = doc.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}
