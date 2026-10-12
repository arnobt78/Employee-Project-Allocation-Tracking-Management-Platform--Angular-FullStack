export interface AvatarSource {
  emailId?: string | null;
  employeeName?: string | null;
  avatarUrl?: string | null;
}

export interface AvatarView {
  seed: string;
  imageUrl: string | null;
  label: string;
}

/**
 * Avatar inputs for `app-user-avatar`. The seed (email, else name) must stay
 * stable so a person shows the same robot on every page.
 */
export function employeeAvatar(
  person: AvatarSource | null | undefined,
  fallbackName = ''
): AvatarView {
  const label = (person?.employeeName || fallbackName || '').trim();
  const seed = (person?.emailId || label).trim();
  return { seed, imageUrl: person?.avatarUrl ?? null, label };
}

/** A project's client contact is not an employee: name plus the contact's own email. */
export function contactAvatar(
  contact: { contactPerson?: string | null; emailId?: string | null } | null | undefined
): AvatarView | null {
  const name = (contact?.contactPerson ?? '').trim();
  if (!name) {
    return null;
  }
  const email = (contact?.emailId ?? '').trim();
  return employeeAvatar({ employeeName: name, emailId: email || null });
}
