import { Atom } from "@effect-atom/atom-react";
import { LiveServicesLayer } from "../services/index.js";

export const appRuntime = Atom.runtime(LiveServicesLayer);
