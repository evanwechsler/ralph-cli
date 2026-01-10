import { Atom } from "@effect-atom/atom-react";
import { pipe } from "effect";

export type Screen = { type: "main-menu" } | { type: "epic-creation" };

export const screenAtom = pipe(
	Atom.make<Screen>({ type: "main-menu" }),
	Atom.keepAlive,
);
