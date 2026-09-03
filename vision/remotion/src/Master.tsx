import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile } from "remotion";

export type MasterProps = {
  clips: string[];
  title: string;
};

const FPS = 30;
const SLOT = FPS * 5;

export const Master: React.FC<MasterProps> = ({ clips }) => {
  return (
    <AbsoluteFill style={{ background: "#050505" }}>
      {(clips || []).map((clip, i) => (
        <Sequence key={clip} from={i * SLOT} durationInFrames={SLOT}>
          <AbsoluteFill>
            <OffthreadVideo
              src={staticFile(clip)}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
