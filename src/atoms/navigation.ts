import { Atom } from "@effect-atom/atom-react";
import { pipe } from "effect";
import type { EpicId } from "../services/EpicRepository.js";

export type Screen =
	| { type: "epic-list" }
	| { type: "epic-detail"; epicId: EpicId }
	| { type: "epic-creation" };

export const screenAtom = pipe(
	Atom.make<Screen>({ type: "epic-list" }),
	Atom.keepAlive,
);
