import { Router } from "express";
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser
} from "../controllers/users.controller";

import { validateBody } from "../../../middlewares/validateBody";
import { createUserSchema, updateUserSchema } from "../validators/user.schemas";

const tenantRouter = Router();

/** Users **/
tenantRouter.post("/users", validateBody(createUserSchema), createUser);
tenantRouter.get("/users", listUsers);
tenantRouter.get("/users/:id", getUser);
tenantRouter.put("/users/:id", validateBody(updateUserSchema), updateUser);
tenantRouter.delete("/users/:id", deleteUser);

export default tenantRouter;
