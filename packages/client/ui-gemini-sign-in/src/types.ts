/** Wire vocabulary of the Gemini sign-in Remote, shared by the Host service and the Client card. */

/**
 * Google sign-in state of the local Antigravity CLI, as one Remote call observed it.
 * - `signed-in`: agy holds a Google sign-in.
 * - `signed-out`: agy holds none; `failure` repeats agy's message when the last code was refused.
 * - `cli-missing`: no agy executable was found.
 * - `pending`: a sign-in waits for the code Google shows after the human authorizes `url`.
 */
export type GeminiSignInStatus =
  | { readonly state: 'signed-in' }
  | { readonly state: 'signed-out'; readonly failure?: string }
  | { readonly state: 'cli-missing' }
  | { readonly state: 'pending'; readonly url: string }
