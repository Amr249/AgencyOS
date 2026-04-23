/**
 * ImageKit server-side client. Never expose private key to the client.
 * Used by /api/upload for client logos and file manager.
 */
import ImageKit from "@imagekit/nodejs";

const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

export function getImageKitClient(): ImageKit | null {
  if (!privateKey || !publicKey || !urlEndpoint) return null;
  return new ImageKit({
    privateKey,
    publicKey,
    urlEndpoint,
  } as ConstructorParameters<typeof ImageKit>[0]);
}

export const IMAGEKIT_CLIENT_LOGO_FOLDER = "agencyos/clients/logos";
export const IMAGEKIT_AGENCY_LOGO_FOLDER = "agencyos/agency/logo";
export const IMAGEKIT_PROJECT_COVER_FOLDER = "agencyos/projects/covers";
export const IMAGEKIT_TEAM_AVATAR_FOLDER = "agencyos/team/avatars";
/** AI Chat attachments (OpenRouter context); uploaded via /api/upload? scope=ai-chat */
export const IMAGEKIT_AI_CHAT_FOLDER = "agencyos/ai-chat";
