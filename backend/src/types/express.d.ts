declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: 'USER' | 'ADMIN';
      userVerified?: boolean;
      userSuspended?: boolean;
    }
  }
}

export {};
