import "express";

declare global {
  namespace Express {
    interface User {
      id: string;
      role?: "admin" | "user";
    }

    interface Request {
      user?: User;

      validatedParams?: unknown;
      validatedQuery?: unknown;
      validatedBody?: unknown;
    }
  }
}

export { };
