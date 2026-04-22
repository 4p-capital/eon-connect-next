import { env } from "./env";

export const projectId = env.supabaseProjectId;
export const publicAnonKey = env.supabaseAnonKey;
export const supabaseUrl = env.supabaseUrl;
export const apiBaseUrl = env.apiBaseUrl;

// Demais funções edge derivam do supabaseUrl — assim trocar o domínio
// (ex: proxy via Cloudflare) propaga para tudo sem mexer em cada componente.
export const clicksignFunctionUrl = `${supabaseUrl}/functions/v1/clicksign`;
