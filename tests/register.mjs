import { register } from "node:module";

register("./node-import-hook.mjs", import.meta.url);
