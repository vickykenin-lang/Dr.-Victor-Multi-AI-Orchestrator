import React from "react";
import { Composition } from "remotion";
import { getVideoMetadata } from "@remotion/media-utils";
import { Master, type MasterProps } from "./Master";

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Master"
      component={Master}
      width={1280}
      height={720}
      fps={FPS}
      durationInFrames={300}
      defaultProps={{ clips: ["K1.mp4", "K2.mp4"], title: "Festival Bonus" }}
      calculateMetadata={async ({ props }: { props: MasterProps }) => {
        let frames = 0;
        for (const clip of props.clips || []) {
          try {
            const meta = await getVideoMetadata(`/public/${clip}`);
            frames += Math.max(1, Math.round((meta.durationInSeconds || 4) * FPS));
          } catch {
            frames += FPS * 5;
          }
        }
        return { durationInFrames: Math.max(FPS, frames), fps: FPS, width: 1280, height: 720 };
      }}
    />
  );
};
