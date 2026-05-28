/**
 * Next.js only executes `middleware.ts` at the project root.
 * `proxy.ts` holds the implementation; this file wires it so dashboard layouts
 * receive `x-pathname` (see `app/dashboard/layout.tsx`).
 */
import { proxy } from "./proxy";

export default proxy;

export { config } from "./proxy";
