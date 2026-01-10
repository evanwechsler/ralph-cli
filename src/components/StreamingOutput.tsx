interface StreamingOutputProps {
	content: string;
	autoScroll?: boolean;
}

/**
 * Component that displays streaming text content with optional auto-scroll.
 * Uses flexGrow to fill available space and displays content with word wrapping.
 */
export function StreamingOutput({
	content,
	autoScroll = true,
}: StreamingOutputProps) {
	return (
		<scrollbox flexGrow={1} stickyScroll={autoScroll} stickyStart="bottom">
			<text wrapMode="word">{content || " "}</text>
		</scrollbox>
	);
}
