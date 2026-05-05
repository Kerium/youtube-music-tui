import type { ReactNode } from "react";

import { theme } from "../theme/theme";

interface ModalWindowProps {
  children: ReactNode;
  footer?: ReactNode;
  height: number;
  title: string;
  width: number;
}

export function ModalWindow({ children, footer, height, title, width }: ModalWindowProps) {
  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      backgroundColor={theme.colors.overlay}
    >
      <box
        width={width}
        height={height}
        flexDirection="column"
        border
        borderStyle="double"
        borderColor={theme.colors.accent}
        backgroundColor={theme.colors.background}
        title={title}
        padding={1}
      >
        <box flexGrow={1} flexDirection="column">
          {children}
        </box>
        {footer ? <box marginTop={1}>{footer}</box> : null}
      </box>
    </box>
  );
}