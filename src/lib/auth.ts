import { requireIdentity, type VerifiedIdentity } from "../../cursor/identity";

export async function requireViewer(
  request: Request,
): Promise<VerifiedIdentity | Response> {
  return requireIdentity(request);
}

export function isAuthFailure(
  value: VerifiedIdentity | Response,
): value is Response {
  return value instanceof Response;
}
