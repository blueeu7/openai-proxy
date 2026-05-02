import { Router, type Request, type Response } from "express";
import { loadSettings, saveSettings, type Settings } from "../lib/settings";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json(loadSettings());
});

router.patch("/", (req: Request, res: Response) => {
  const patch = req.body as Partial<Settings>;
  const updated = saveSettings(patch);
  res.json(updated);
});

export default router;
