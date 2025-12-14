import { ErrorCodes, HttpError } from "../utils/httpErrors";

export function comandaNotFound() {
  return new HttpError({
    status: 404,
    code: ErrorCodes.NOT_FOUND,
    message: "Comanda nao encontrada",
  });
}

export function comandaNumberConflict(number: string) {
  return new HttpError({
    status: 409,
    code: ErrorCodes.CONFLICT,
    message: "Numero de comanda ja existe para este tenant",
    details: { number },
  });
}
