import { type Request, type Response } from "express";
import { ErrorCodes, respondWithError } from "../../utils/httpErrors";
import { issueSuperAdminToken, verifySuperAdminCredentials } from "../auth.service";

export const loginSuperAdmin = async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  const isValid = await verifySuperAdminCredentials(email, password);
  if (!isValid) {
    return respondWithError(res, {
      status: 401,
      code: ErrorCodes.INVALID_CREDENTIALS,
      message: "Credenciais de super admin invalidas.",
    });
  }

  const { token, expiresIn } = issueSuperAdminToken();
  return res.json({
    token,
    tokenType: "Bearer",
    expiresIn,
  });
};
