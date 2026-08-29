import { OAuth2Client } from "google-auth-library";

import { googleProfileError } from "../errors";
import { getStudioAuthEnv } from "../validation";

export type GoogleProfile = {
  email: string;
  name: string;
};

function createOAuth2Client(): OAuth2Client {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    getStudioAuthEnv();

  return new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );
}

/** Build the Google consent screen URL for Studio sign-in. */
export function buildGoogleAuthUrl(state: string): string {
  const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = getStudioAuthEnv();
  const client = createOAuth2Client();

  return client.generateAuthUrl({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
  });
}

/** Exchange the OAuth code for a verified Google profile. */
export async function getGoogleProfileFromCode(
  code: string,
): Promise<GoogleProfile> {
  const { GOOGLE_CLIENT_ID } = getStudioAuthEnv();
  const client = createOAuth2Client();

  let tokens;
  try {
    const result = await client.getToken(code);
    tokens = result.tokens;
  } catch (cause) {
    throw googleProfileError(cause);
  }

  if (!tokens.id_token) {
    throw googleProfileError(new Error("Google response missing id_token"));
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (cause) {
    throw googleProfileError(cause);
  }

  const email = payload?.email?.trim().toLowerCase();
  if (!email || !payload?.email_verified) {
    throw googleProfileError(new Error("Google account email not verified"));
  }

  return {
    email,
    name: payload.name?.trim() || email.split("@")[0] || "Team member",
  };
}
