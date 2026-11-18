import { toast } from "sonner";
import { addLog } from "./logStore";

const line = (title: string, description?: string) =>
  description ? `${title}: ${description}` : title;

/** Shows a toast and records the same message in the activity log. */
export const notify = {
  success(title: string, description?: string) {
    toast.success(title, { description, duration: 3000 });
    addLog("step", line(title, description));
  },
  error(title: string, description?: string) {
    // Errors stay until dismissed long enough to be read.
    toast.error(title, { description, duration: 8000 });
    addLog("error", line(title, description));
  },
};
