import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  addTracksToProject,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "../controllers/projectController.js";

export const projectsRouter = Router();

projectsRouter.post("/", asyncHandler(createProject));
projectsRouter.get("/", asyncHandler(listProjects));
projectsRouter.post("/:id/tracks", asyncHandler(addTracksToProject));
projectsRouter.get("/:id", asyncHandler(getProject));
projectsRouter.patch("/:id", asyncHandler(updateProject));
projectsRouter.delete("/:id", asyncHandler(deleteProject));
