import type { LessonBookFB } from "./types";

declare global {
  interface Window {
    LessonBookFB?: LessonBookFB;
  }

  interface WindowEventMap {
    "lessonbook-fb-ready": Event;
  }
}

export {};
