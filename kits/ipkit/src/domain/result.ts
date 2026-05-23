import type { IpKitError } from "./errors/IpKitError";

export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; error: IpKitError };
export type Result<T> = Ok<T> | Err;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err(error: IpKitError): Err {
  return { ok: false, error };
}

export function unwrapOr<T>(result: Result<T>, fallback: T): T {
  return result.ok ? result.value : fallback;
}
