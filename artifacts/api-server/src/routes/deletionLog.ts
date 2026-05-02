import { Router, type Request, type Response } from "express";
import { loadDeletionLog, clearDeletionLog } from "../lib/deletionLog";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json(loadDeletionLog());
});

router.delete("/", (_req: Request, res: Response) => {
  clearDeletionLog();
  res.json({ ok: true });
});

export default router;
